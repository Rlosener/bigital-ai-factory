import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { usePolling } from "./usePolling";

type PollSnapshot<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

function PollingProbe<T>(props: {
  fetcher: () => Promise<T>;
  intervalMs: number;
  onSnapshot: (snapshot: PollSnapshot<T>) => void;
}) {
  const state = usePolling(props.fetcher, props.intervalMs);
  useEffect(() => {
    props.onSnapshot({
      data: state.data,
      loading: state.loading,
      error: state.error,
    });
  }, [state.data, state.loading, state.error, props]);
  return null;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("초기 로드 후 interval마다 fetcher를 재호출한다", async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValueOnce("initial").mockResolvedValueOnce("second");
    const snapshots: Array<PollSnapshot<string>> = [];

    render(<PollingProbe fetcher={fetcher} intervalMs={1000} onSnapshot={(snapshot) => snapshots.push(snapshot)} />);

    await act(async () => {
      await flushMicrotasks();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(snapshots.at(-1)).toMatchObject({
      data: "initial",
      loading: false,
      error: null,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await flushMicrotasks();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(snapshots.at(-1)).toMatchObject({
      data: "second",
      loading: false,
      error: null,
    });
  });

  it("fetch 실패 시 error 상태를 노출한다", async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("boom"));
    const snapshots: Array<PollSnapshot<string>> = [];

    render(<PollingProbe fetcher={fetcher} intervalMs={1000} onSnapshot={(snapshot) => snapshots.push(snapshot)} />);

    await act(async () => {
      await flushMicrotasks();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(snapshots.some((snapshot) => snapshot.error === "boom")).toBe(true);
  });

  it("does not replace a newer response with a slower earlier request", async () => {
    let resolveFirst!: (value: string) => void;
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce("newer");
    const snapshots: Array<PollSnapshot<string>> = [];
    render(<PollingProbe fetcher={fetcher} intervalMs={1000} onSnapshot={(snapshot) => snapshots.push(snapshot)} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await flushMicrotasks();
    });
    expect(snapshots.at(-1)?.data).toBe("newer");
    await act(async () => {
      resolveFirst("older");
      await flushMicrotasks();
    });
    expect(snapshots.at(-1)?.data).toBe("newer");
  });

  it("ignores a response from the previous dependency scope", async () => {
    let resolvePrevious!: (value: string) => void;
    const oldFetcher = () =>
      new Promise<string>((resolve) => {
        resolvePrevious = resolve;
      });
    const newFetcher = () => Promise.resolve("project two");
    const snapshots: Array<PollSnapshot<string>> = [];
    function ScopedProbe({ fetcher }: { fetcher: () => Promise<string> }) {
      const state = usePolling(fetcher, 1000, [fetcher]);
      useEffect(() => {
        snapshots.push({ data: state.data, loading: state.loading, error: state.error });
      }, [state.data, state.loading, state.error]);
      return null;
    }
    const { rerender } = render(<ScopedProbe fetcher={oldFetcher} />);
    rerender(<ScopedProbe fetcher={newFetcher} />);
    await act(async () => {
      await flushMicrotasks();
    });
    expect(snapshots.at(-1)?.data).toBe("project two");
    await act(async () => {
      resolvePrevious("project one");
      await flushMicrotasks();
    });
    expect(snapshots.at(-1)?.data).toBe("project two");
  });

  it("문서가 hidden이면 interval을 멈추고 visible에서 즉시 재개한다", async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValue("ok");
    const snapshots: Array<PollSnapshot<string>> = [];

    render(<PollingProbe fetcher={fetcher} intervalMs={800} onSnapshot={(snapshot) => snapshots.push(snapshot)} />);

    await act(async () => {
      await flushMicrotasks();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2400);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await act(async () => {
      await flushMicrotasks();
    });
    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
      await flushMicrotasks();
    });
    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(snapshots.at(-1)?.error).toBeNull();
  });
});

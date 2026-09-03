import { Component, type ErrorInfo, type ReactNode } from "react";
import { getStoredLocale, type AppLocale } from "@/lib/locale";

type Copy = {
  title: string;
  description: string;
  retry: string;
  home: string;
};

const COPY: Record<AppLocale, Copy> = {
  ko: {
    title: "일시적인 오류가 발생했습니다",
    description: "페이지를 다시 불러오면 대부분 해결됩니다. 문제가 계속되면 잠시 후 다시 시도해 주세요.",
    retry: "다시 시도",
    home: "홈으로",
  },
  en: {
    title: "Something went wrong",
    description: "Reloading the page usually fixes this. If the problem persists, please try again in a moment.",
    retry: "Try again",
    home: "Go to home",
  },
  zh: {
    title: "发生了临时错误",
    description: "重新加载页面通常可以解决此问题。如果问题仍然存在，请稍后再试。",
    retry: "重试",
    home: "返回首页",
  },
  ja: {
    title: "一時的なエラーが発生しました",
    description: "ページを再読み込みすると解決する場合がほとんどです。問題が続く場合は、しばらくしてからお試しください。",
    retry: "再試行",
    home: "ホームへ",
  },
};

/** 앱 프로바이더가 깨진 상황에서도 동작해야 하므로 context 대신 저장값을 직접 읽는다 */
function safeLocale(): AppLocale {
  try {
    return getStoredLocale();
  } catch {
    return "ko";
  }
}

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * 렌더링 중 발생한 예외를 잡아 빈 화면 대신 복구 안내를 보여준다.
 *
 * 주의: React 오류 경계는 렌더·라이프사이클 예외만 잡는다.
 * 이벤트 핸들러와 비동기 코드의 예외는 여기로 오지 않는다.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 에러 모니터링(Sentry 등) 도입 시 이 지점에서 전송한다 (안내서 B-4)
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleRetry = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.assign("/main");
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const copy = COPY[safeLocale()];

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-3 text-xl font-bold text-foreground">{copy.title}</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            {copy.description}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="h-11 w-full rounded-lg bg-primary font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {copy.retry}
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              className="h-11 w-full rounded-lg border border-border font-medium text-foreground transition-colors hover:bg-muted"
            >
              {copy.home}
            </button>
          </div>

          {import.meta.env.DEV && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                개발자용 상세 정보
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-[11px] text-muted-foreground">
                {error.stack ?? String(error)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

// Top-level error boundary — a render crash shows a recovery card instead of a white screen.
import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[ui] render error:", error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="app" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div className="login-card" style={{ maxWidth: 460, textAlign: "center", padding: 28 }}>
            <h1 className="login-title">Something went wrong</h1>
            <p className="login-sub" style={{ marginBottom: 16 }}>
              The page hit an unexpected error. Reloading usually fixes it — your data is safe.
            </p>
            <button type="button" className="btn btn-primary login-btn"
              onClick={() => window.location.reload()}>Reload app</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

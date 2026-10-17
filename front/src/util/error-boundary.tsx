import * as React from 'react';

/**
 * Error boundary that just logs errors to the console.
 */
export class ErrorBoundary extends React.PureComponent<
  React.PropsWithChildren<{}>,
  {}
> {
  public componentDidCatch(err: Error) {
    console.error(err);
  }
  public render() {
    return <>{this.props.children}</>;
  }
}

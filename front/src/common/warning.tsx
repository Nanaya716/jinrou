import styled from 'styled-components';
import * as React from 'react';

export interface IPropInlineWarning {
  className?: string;
  children?: React.ReactNode;
}
/**
 * Inline warning component.
 */
const InlineWarningInner: React.FC<IPropInlineWarning> = ({
  className,
  children,
}) => {
  return <span className={className}>{children}</span>;
};

export const InlineWarning = styled(InlineWarningInner)`
  color: #ff0000;
`;

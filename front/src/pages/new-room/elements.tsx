import styled from '../../util/styled';
import { AppStyling } from '../../styles/phone';

/**
 * Wrapper of whole page.
 */
export const Wrapper = styled(AppStyling)`
  padding: 0 20px 20px;
`;

/**
 * Wrapper of village rule template controls.
 */
export const TemplateControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em;
  margin-top: 0.4em;
`;

export const VillageRulesRichEditor = styled.div`
  overflow: hidden;
  border: 1px solid #bbbbbb;
  border-radius: 8px;
  background: #fafafa;
`;

export const MarkdownToolbar = styled.div`
  display: flex;
  gap: 0.35em;
  padding: 0.45em;
  border-bottom: 1px solid #cccccc;
`;

export const MarkdownButton = styled.button`
  min-width: 3.5em;
  height: 2em;
  padding: 0 0.5em;
  border: 1px solid #999;
  background: #fff;
  color: #222;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: #eeeeee;
  }
`;

export const VillageRulesRichEditorSurface = styled.div`
  min-height: 10em;
  overflow: auto;
  resize: both;
  padding: 0.75em;
  box-sizing: border-box;
  background: #ffffff;
  color: #222;
  line-height: 1.5;
  outline: none;

  h3,
  h4,
  p {
    margin: 0.45em 0;
  }

  h3,
  h4 {
    font-size: 1em;
    font-weight: bold;
  }

  h3:first-child,
  h4:first-child,
  p:first-child {
    margin-top: 0;
  }

  .village-rules-choice {
    display: inline-flex;
    align-items: center;
    margin: 0 0.75em 0.3em 0;
    white-space: nowrap;
  }

  .village-rules-choice-text {
    display: inline-block;
    min-width: 0.5em;
  }

  input {
    margin-right: 0.45em;
  }

  ul {
    margin: 0.45em 0;
    padding-left: 1.5em;
    list-style: disc;
  }

  li {
    list-style: disc;
  }
`;

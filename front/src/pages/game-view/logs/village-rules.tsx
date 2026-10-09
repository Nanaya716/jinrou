import * as React from 'react';
import styled from '../../../util/styled';

const Rules = styled.div`
  white-space: normal;
  overflow-wrap: anywhere;

  h3,
  h4 {
    margin: 0.55em 0 0.3em;
    font-size: 1em;
    font-weight: bold;
  }

  h3:first-child,
  h4:first-child {
    margin-top: 0;
  }

  .village-rules-line {
    margin: 0.2em 0;
    white-space: pre-wrap;
  }

  .village-rules-choice {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    margin: 0 0.75em 0.3em 0;
  }

  .village-rules-choice input {
    flex-shrink: 0;
    margin-right: 0.45em;
  }

  .village-rules-choice-text {
    min-width: 0;
    white-space: pre-wrap;
  }
`;

function inlineText(text: string): React.ReactNode {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      /^\*\*[^*]+\*\*$/.test(part) ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

/** Read-only rendering of the same syntax used by the village rules editor. */
export const VillageRulesContent = React.memo(function VillageRulesContent({
  content,
}: {
  content: string;
}) {
  return (
    <Rules>
      {content.split(/\r?\n/).map((line, index) => {
        if (line === '---' || line === '') {
          return <br key={index} />;
        }
        const checkbox = line.match(/^- \[([ xX])\] (.*)$/);
        const radio = line.match(/^- \(([ xX])\) (.*)$/);
        const bullet = line.match(/^- (.*)$/);
        const heading = line.match(/^(#{1,2}) (.*)$/);
        if (heading) {
          const Heading = heading[1] === '#' ? 'h3' : 'h4';
          return <Heading key={index}>{inlineText(heading[2])}</Heading>;
        }
        const choice = checkbox || radio;
        if (choice) {
          const checked = choice[1].toLowerCase() === 'x';
          return (
            <label className="village-rules-choice" key={index}>
              <input
                type={checkbox ? 'checkbox' : 'radio'}
                checked={checked}
                disabled
              />
              <span
                className="village-rules-choice-text"
                style={checked ? { fontWeight: 'bold' } : undefined}
              >
                {inlineText(choice[2])}
              </span>
            </label>
          );
        }
        return (
          <div className="village-rules-line" key={index}>
            {bullet ? '• ' : null}
            {inlineText(bullet ? bullet[1] : line)}
          </div>
        );
      })}
    </Rules>
  );
});

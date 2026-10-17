import * as React from 'react';
import styled from 'styled-components';
import { I18n, TranslationFunction } from '../../i18n';
import { RuleGroup, Rule, RoleCategoryDefinition } from '../../defs';

import { getRuleExpression } from '../../logic/rule';

export interface IPropShowRule {
  /**
   * Current rule.
   */
  rule: Rule;
  /**
   * Definition of categories.
   */
  categories: RoleCategoryDefinition[];
  /**
   * Definition of rules.
   */
  ruleDefs: RuleGroup;
}
/**
 * Component which shows current rule.
 */
export class ShowRule extends React.PureComponent<IPropShowRule, {}> {
  public render() {
    const { categories, rule, ruleDefs } = this.props;
    return (
      <I18n>
        {t => (
          <>
            {rule.jobNumbers != null ? (
              <JobNumbers
                categories={categories}
                jobs={rule.jobNumbers}
                t={t}
              />
            ) : null}
            {rule.rules != null ? (
              <RuleTable>
                <tbody>
                  <MajoantiMagics rule={rule} t={t} />
                  <RuleItems items={ruleDefs} rule={rule} t={t} />
                </tbody>
              </RuleTable>
            ) : null}
          </>
        )}
      </I18n>
    );
  }
}

/**
 * Show the number of jobs.
 */
class JobNumbers extends React.PureComponent<
  {
    categories: RoleCategoryDefinition[];
    jobs: Record<string, number>;
    t: TranslationFunction;
  },
  {}
> {
  public render() {
    const { categories, jobs, t } = this.props;
    return (
      <p>
        {categories.map(({ id, roles }) => (
          <React.Fragment key={id}>
            {roles.map(role =>
              jobs[role] > 0 ? (
                <React.Fragment key={role}>
                  <a href={`/manual/job/${role}`}>
                    {t(`roles:jobname.${role}`)}
                    {jobs[role]}
                  </a>{' '}
                </React.Fragment>
              ) : null,
            )}
          </React.Fragment>
        ))}
      </p>
    );
  }
}

const MajoantiMagics: React.FC<{
  rule: Rule;
  t: TranslationFunction;
}> = ({ rule, t }) => {
  const magics = (rule.majoantiMagics || []).map(magic =>
    typeof magic === 'string'
      ? {
          name: t(`roles:${magic}.name`),
          type: magic,
        }
      : magic,
  );
  if (magics.length === 0) {
    return null;
  }
  return (
    <>
      <tr>
        <th colSpan={2}>{t('game_client:rule.majoantiMagics')}</th>
      </tr>
      <tr>
        <td colSpan={2}>
          {[
            ...mapJoin(magics, ' ', magic => (
              <a
                key={magic.type}
                href={`/manual/job/${magic.type}?jobname=${encodeURIComponent(
                  magic.name,
                )}`}
                data-jobname={magic.name}
              >
                {magic.name}
              </a>
            )),
          ]}
        </td>
      </tr>
    </>
  );
};

/**
 * Show value of each rule.
 */
class RuleItems extends React.PureComponent<
  {
    rule: Rule;
    items: RuleGroup;
    t: TranslationFunction;
  },
  {}
> {
  public render() {
    const { rule, items, t } = this.props;
    const { rules } = rule;
    return items.map(item => {
      if (item.type === 'group') {
        // group of rule
        const groupdef = item.label;

        // check visibility of this group.
        if (!groupdef.visible(rule, false)) {
          return null;
        }

        return (
          <React.Fragment key={`group-${groupdef.id}`}>
            <tr>
              <th colSpan={2}>{t(`rules:ruleGroup.${groupdef.id}.name`)}</th>
            </tr>
            <RuleItems rule={rule} items={item.items} t={t} />
          </React.Fragment>
        );
      } else {
        const ruledef = item.value;
        if (ruledef.type === 'separator' || ruledef.type === 'hidden') {
          // non-setting or hidden rule is not displayed
          return null;
        }
        if (ruledef.disabled != null && ruledef.disabled(rule, false)) {
          // disabled setting
          return null;
        }
        const re = getRuleExpression(t, ruledef, rules.get(ruledef.id) || '');
        if (re == null) {
          return null;
        }
        const { label, value } = re;
        return value ? (
          <tr key={`item-${ruledef.id}`}>
            <td>{label}</td>
            <td>{value}</td>
          </tr>
        ) : null;
      }
    });
  }
}

/**
 * map and join given array.
 */
function* mapJoin<T, U>(
  arr: T[],
  join: string,
  func: (elm: T, idx: number) => U,
): IterableIterator<U | string> {
  let idx = 0;
  for (const elm of arr) {
    if (idx > 0) {
      yield join;
    }
    yield func(elm, idx);
    idx++;
  }
}

const RuleTable = styled.table`
  width: 100%;

  th,
  td {
    border: none;
  }
  th {
    padding-top: 2px;
    text-align: center;
    border-bottom: 1px solid rgba(0, 0, 0, 0.42);
  }
  td {
    border-bottom: 1px dashed rgba(0, 0, 0, 0.3);
  }
`;

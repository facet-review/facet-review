import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { formatNumber } from '../../app/format';
import { screeningPaths, type StageSlug } from '../../app/modules';
import NotFoundPage from '../../app/NotFoundPage';
import { PageHeading } from '../../app/PageHeading';
import notice from '../../design/notice.module.css';
import { undoLast, type DecisionInput } from '../../domain/screening/decide';
import {
  fullTextGate,
  stageItems,
  stageProgress,
  statusIn,
  type StageFilter,
  type UnitScreening,
} from '../../domain/screening/stages';
import type { ScreeningStage } from '../../domain/types';
import { useProject } from '../project/useProject';
import { decide } from './actions';
import { DecisionPanel } from './DecisionPanel';
import { parseFilter } from './filters';
import { RecordView } from './RecordView';
import styles from './Screening.module.css';
import {
  HistorySection,
  MarkDuplicateSection,
  RemovalSection,
  StatusNotice,
  StudySection,
} from './UnitExtras';
import { useHighlightPreference } from './useHighlightPreference';
import { STAGE_OF_SLUG, useScreening, type ScreeningData } from './useScreening';
import { useShortcutPreference } from './useShortcuts';

/** One unit at a time (PRD Modul 4). The live region outlives the unit views. */
export default function ScreeningUnitPage() {
  const { t } = useTranslation();
  const project = useProject();
  const params = useParams();
  const data = useScreening(project.id);
  const [announcement, setAnnouncement] = useState('');
  // Records decided in this visit stay reachable with ← even if they leave the filter.
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const markSeen = (ids: readonly string[]) => setSeen((current) => new Set([...current, ...ids]));
  const slug = params.stage as StageSlug;
  const stage = STAGE_OF_SLUG[slug];

  if (!stage) return <NotFoundPage />;
  return (
    <>
      <PageHeading title={t('screening.unitTitle', { stage: t(`screening.stage.${stage}`) })} />
      <p role="status" className="visually-hidden">
        {announcement}
      </p>
      {data === undefined ? (
        <p>{t('common.loading')}</p>
      ) : (
        <UnitRoute
          data={data}
          stage={stage}
          slug={slug}
          announce={setAnnouncement}
          seen={seen}
          markSeen={markSeen}
        />
      )}
    </>
  );
}

interface RouteProps {
  data: ScreeningData;
  stage: ScreeningStage;
  slug: StageSlug;
  announce: (text: string) => void;
  seen: ReadonlySet<string>;
  markSeen: (recordIds: readonly string[]) => void;
}

function UnitRoute({ data, stage, slug, announce, seen, markSeen }: RouteProps) {
  const { t } = useTranslation();
  const { recordId = '' } = useParams();
  const [search] = useSearchParams();
  const filter = parseFilter(search.get('filter'), stage);
  // URLs name a record, not a group: group keys change with merges, splits and
  // primary changes, the unit containing the record is always found.
  const screening = data.unitOfRecord.get(recordId);
  const back = screeningPaths.page(data.project.id, slug, filter);

  if (!screening) {
    return (
      <p className={`${notice.notice} ${notice.warning}`}>
        {t('screening.unitGone')} <Link to={back}>{t('screening.backToList')}</Link>
      </p>
    );
  }
  return (
    <UnitView
      key={screening.unit.key}
      data={data}
      screening={screening}
      stage={stage}
      slug={slug}
      filter={filter}
      announce={announce}
      seen={seen}
      markSeen={markSeen}
    />
  );
}

interface ViewProps extends Omit<RouteProps, 'data'> {
  data: ScreeningData;
  screening: UnitScreening;
  filter: StageFilter;
}

function UnitView({ data, screening, stage, slug, filter, announce, seen, markSeen }: ViewProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [shortcuts] = useShortcutPreference();
  const [highlight] = useHighlightPreference();
  const [message, setMessage] = useState('');
  const projectId = data.project.id;
  const who = { projectId, reviewerId: data.reviewerId };
  const settings = data.project.screening;

  // After the layout has moved focus to <main> on navigation, put it on the record.
  useEffect(() => {
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  // Navigation list: the filtered list, keeping the current unit and the ones
  // decided in this visit in place even if they no longer match the filter.
  const all = stageItems(data.evaluated, stage, 'all');
  const filtered = new Set(stageItems(data.evaluated, stage, filter));
  const list = all.filter(
    (s) => s === screening || filtered.has(s) || s.unit.memberIds.some((id) => seen.has(id)),
  );
  const index = list.indexOf(screening);
  const previous = index > 0 ? list[index - 1] : undefined;
  const next = index >= 0 ? list[index + 1] : undefined;
  const progress = stageProgress(data.evaluated, stage);
  const locked = stage === 'full_text' && fullTextGate(data.evaluated, settings).locked;
  const inStage = stage === 'title_abstract' ? screening.inTitleAbstract : screening.inFullText;
  const status = statusIn(screening, stage);
  const number = (n: number) => formatNumber(n, i18n.language);

  const go = (target: UnitScreening | undefined) => {
    if (target) void navigate(screeningPaths.unit(projectId, slug, target.unit.primaryId, filter));
  };

  // One decision at a time: keys pressed while saving and moving on would
  // otherwise land on the unit that is still shown.
  const busy = useRef(false);
  const onDecide = async (input: DecisionInput) => {
    if (busy.current) return;
    busy.current = true;
    const target = next;
    try {
      await decide(who, screening.unit, input);
      markSeen(screening.unit.memberIds);
    } finally {
      busy.current = false;
    }
    const done = t(`screening.value.${input.value}`);
    if (input.stage === stage && target && input.value !== 'reset') {
      announce(t('screening.announce.next', { decision: done }));
      go(target);
    } else if (input.stage === stage && !target && input.value !== 'reset') {
      announce('');
      void navigate(screeningPaths.page(projectId, slug, filter), {
        state: { message: t('screening.announce.endOfList', { decision: done }) },
      });
    } else {
      setMessage(t('screening.announce.saved', { decision: done }));
    }
  };

  const onUndo = async () => {
    if (busy.current) return;
    const plan = undoLast(data.decisions, stage, data.reviewerId);
    if (!plan) {
      setMessage(t('screening.announce.nothingToUndo'));
      return;
    }
    await decide(who, plan.unit, plan.input);
    const target = data.evaluated.find((s) => s.unit.memberIds.includes(plan.target.shownRecordId));
    announce(t('screening.announce.undone'));
    if (target && target !== screening) go(target);
    else setMessage(t('screening.announce.undone'));
  };

  return (
    <div className={styles.unitLayout}>
      <nav aria-label={t('screening.position.label')} className={styles.position}>
        <Link to={screeningPaths.page(projectId, slug, filter)}>{t('screening.backToList')}</Link>
        <span>
          {index >= 0
            ? t('screening.position.text', {
                n: number(index + 1),
                total: number(list.length),
                filter: t(`screening.filter.${filter}`),
              })
            : null}
        </span>
        <span>
          {t('screening.decidedOf', {
            decided: number(progress.decided),
            total: number(progress.total),
          })}
        </span>
      </nav>

      <p role="status" className={message ? notice.notice : 'visually-hidden'}>
        {message}
      </p>

      {locked && (
        <p className={`${notice.notice} ${notice.warning}`}>
          {t('screening.gate.locked', { count: fullTextGate(data.evaluated, settings).maybes })}
        </p>
      )}
      {!inStage && !screening.removed && (
        <p className={`${notice.notice} ${notice.warning}`}>
          {t(stage === 'full_text' ? 'screening.notInFullText' : 'screening.notInTitleAbstract')}
        </p>
      )}
      {inStage && (
        <StatusNotice data={data} status={status} onAdopt={(input) => void onDecide(input)} />
      )}

      <RecordView
        ref={titleRef}
        data={data}
        unit={screening.unit}
        highlights={settings.highlights}
        highlight={highlight}
      />

      <DecisionPanel
        stage={stage}
        reasons={data.project.exclusionReasons}
        disabled={!inStage || locked}
        shortcuts={shortcuts}
        onDecide={(input) => void onDecide(input)}
        onPrevious={previous ? () => go(previous) : undefined}
        onNext={next ? () => go(next) : undefined}
        onUndo={() => void onUndo()}
      />

      {stage === 'full_text' && (
        <StudySection data={data} screening={screening} onDone={setMessage} />
      )}
      <RemovalSection screening={screening} onDecide={(input) => void onDecide(input)} />
      {!screening.removed && (
        <MarkDuplicateSection data={data} screening={screening} onDone={setMessage} />
      )}
      <HistorySection data={data} screening={screening} />
    </div>
  );
}

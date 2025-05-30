import type {
  TimelineDate,
  TimelineDefinition,
  TimelineEra,
  TimelineSlide,
} from '@knight-lab/timelinejs';
import { H5PMedia } from 'h5p-types';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Grid } from '../components/Grid/Grid';
import { Tags } from '../components/Tags/Tags';
import { DateString } from '../types/DateString';
import { Era } from '../types/Era';
import { EventItemType } from '../types/EventItemType';
import { Params } from '../types/Params';
import { SlideType } from '../types/SlideType';
import { isDefined } from './is-defined.utils';

const html = String.raw;

/** @constant {number} MIN_HUMAN_SCALE_YEAR Minimum year that can be displayed in human scale */
export const MIN_HUMAN_SCALE_YEAR = -271820;

/** @constant {number} MAX_HUMAN_SCALE_YEAR Maximum year that can be displayed in human scale */
export const MAX_HUMAN_SCALE_YEAR = 275759;

export const isDateString = (str: string): str is DateString => {
  const matches = str.match(/^-?\d{1,}((-\d{1,2})?(-\d{1,2})?)$/gi);

  return !!matches && matches.length > 0;
};

export const parseDateString = (dateString: DateString): TimelineDate => {
  const isNegativeYear = dateString.startsWith('-');
  let year: string;
  let month: string;
  let day: string;

  if (isNegativeYear) {
    [, year, month, day] = dateString.split('-');
  }
  else {
    [year, month, day] = dateString.split('-');
  }

  const ret: TimelineDate = {
    year: Number.parseInt(year, 10) * (isNegativeYear ? -1 : 1),
  };

  if (month) {
    ret.month = Number.parseInt(month, 10);
  }

  if (day) {
    ret.day = Number.parseInt(day, 10);
  }

  return ret;
};

/*
 * Firefox cannot handle negative years in Date.parse unless the argument uses
 * ISO 8601 format with expanded years.
 * @see https://tc39.es/ecma262/#sec-expanded-years
 */
const isDateValid = (dateString: DateString): boolean => {
  const date = parseDateString(dateString);
  const year =
    date.year < 0
      ? `-${(-1 * date.year).toString().padStart(6, '0')}`
      : `+${date.year.toString().padStart(6, '0')}`;
  const month = (date.month ?? 1).toString().padStart(2, '0');
  const day = (date.day ?? 1).toString().padStart(2, '0');

  /*
   * -271821 is the smallest year that Date.parse can handle. The return value
   * would exceed the maximum number that ECMAScript can handle, cmp.
   * https://262.ecma-international.org/5.1/#sec-15.9.1.1
   */
  if (date.year < MIN_HUMAN_SCALE_YEAR || date.year > MAX_HUMAN_SCALE_YEAR) {
    return true; // Will requite to enforce scale of "cosmological"
  }

  return !Number.isNaN(Date.parse(`${year}-${month}-${day}T00:00:00Z`));
};

export const parseDate = (dateString: string): TimelineDate | null => {
  if (!isDateString(dateString)) {
    return null;
  }

  if (!isDateValid(dateString)) {
    return null;
  }

  return parseDateString(dateString);
};

const getMedia = (
  eventItem: EventItemType<SlideType>,
): string | H5PMedia | undefined => {
  let media;

  switch (eventItem.mediaType) {
    case 'image':
      media = eventItem.image;
      break;

    case 'video':
      media = eventItem.video?.[0];
      break;

    case 'audio':
      media = eventItem.audio?.[0];
      break;

    case 'custom':
      media = eventItem.customMedia;
      break;

    case 'none':
      media = undefined;
      break;
  }

  return media;
};

const isDateOrderOK = (
  startDate: TimelineDate | null,
  endDate: TimelineDate | null,
): boolean => {
  const start: TimelineDate = Object.create(startDate);
  start.year = start.year ?? -Infinity;
  start.month = start.month ?? -Infinity;
  start.day = start.day ?? -Infinity;

  const end: TimelineDate = Object.create(endDate);
  end.year = end.year ?? Infinity;
  end.month = end.month ?? Infinity;
  end.day = end.day ?? Infinity;

  return !(
    start.year > end.year ||
    (start.year === end.year && start.month > end.month) ||
    (start.year === end.year &&
      start.month === end.month &&
      start.day > end.day)
  );
};

export const mapEventToTimelineSlide = (
  event: EventItemType<SlideType>,
): TimelineSlide => {
  const startDate = event.startDate ? parseDate(event.startDate) : null;

  let text;
  const eventHasCustomLayout = event.layout === 'custom';
  if (eventHasCustomLayout) {
    text = renderToStaticMarkup(<Grid eventItem={event} />);
  }
  else {
    let tagsMarkup = '';

    // TODO: Make a variable `hasTags` for this ugly if when TypeScript supports it
    if ('tags' in event && event.tags && event.tags.length > 0) {
      // Has tags
      tagsMarkup = renderToStaticMarkup(
        <div className="h5p-tl-tags-container">
          <Tags tags={event.tags} />
        </div>,
      );
    }
    text = tagsMarkup;

    if (event.description) {
      text += html`<div class="h5p-tl-slide-description">
        ${event.description.params.text ?? ''}
      </div>`;
    }
  }

  // The `layout-x` part of this ID is used for styling and must not be removed
  // before we find another way to change slide layouts
  // Work around h5p-types that fails jest test when importing H5P
  const id = `${(window as any).H5P.createUUID()}_layout-${event.layout}`;
  const endDate = event.endDate ? parseDate(event.endDate) : null;
  const slide: TimelineSlide = {
    unique_id: id,
    start_date: startDate ?? undefined,
    end_date: endDate ?? undefined,
    text: {
      headline: event.title,
      text,
    },
  };

  if (!isDateOrderOK(startDate, endDate)) {
    // Do something to alert end-user of dates mismatch.
    console.error(
      `End date (${event.endDate}) should be LATER than start date (${event.startDate}) in Slide "${event.title}"`,
    );
  }

  const media = getMedia(event);
  if (media) {
    slide.media = {
      url: typeof media === 'string' ? media : media.path,
      alt: event.mediaType === 'image' ? event.imageAlt : undefined,
    };
  }

  if (event.appearance.backgroundType === 'color') {
    slide.background = {
      color: event.appearance.backgroundColor,
    };
  }
  else if (event.appearance.backgroundType === 'image') {
    slide.background = {
      url: event.appearance.backgroundImage?.path,
    };
  }

  return slide;
};

export const mapEraToTimelineEra = (era: Era): TimelineEra | null => {
  const startDate = parseDate(era.startDate);
  const endDate = parseDate(era.endDate);

  if (!startDate || !endDate) {
    return null;
  }

  if (!isDateOrderOK(startDate, endDate)) {
    // Do something to alert end-user of dates mismatch.
    console.error(
      `End date (${era.endDate}) should be LATER than start date (${era.startDate}) in Era "${era.name}"`,
    );
  }

  return {
    start_date: startDate,
    end_date: endDate,
    text: {
      headline: era.name,
    },
  };
};

export const createTimelineDefinition = (
  title: string,
  data: Params,
): [TimelineDefinition, string | undefined] => {
  const items = data.timelineItems ?? [];
  const events = items.map(mapEventToTimelineSlide).filter(isDefined);
  const eras = (data.eras ?? []).map(mapEraToTimelineEra).filter(isDefined);

  const timeline: TimelineDefinition = {
    eras,
    events,
  };

  if (data.showTitleSlide && data.titleSlide) {
    // eslint-disable-next-line no-param-reassign
    data.titleSlide.title = data.titleSlide.title ?? title;
    timeline.title =
      data.titleSlide && mapEventToTimelineSlide(data.titleSlide);
  }

  let classNames: string | undefined;

  const needsComsicScale = events.some((event) => {
    return (
      (event.start_date?.year ?? 0) < MIN_HUMAN_SCALE_YEAR ||
      (event.start_date?.year ?? 0) > MAX_HUMAN_SCALE_YEAR
    );
  });

  const scalingMode = needsComsicScale ?
    'cosmological' :
    data.behaviour?.scalingMode ?? 'human';
  const eventsAreIndexed = scalingMode === 'index';

  if (eventsAreIndexed) {
    classNames = 'h5p-timeline--indexed';
  }
  else {
    timeline.scale = scalingMode;
  }

  return [timeline, classNames];
};

export const fallbackLocale = 'en';

export const getClosestLocaleCode = (element: Element | null): string => {
  const closestElementWithLanguageAttribute = element?.closest(
    '[lang], [xml\\:lang]',
  );

  const activeLocaleCode =
    closestElementWithLanguageAttribute?.getAttribute('lang') ??
    closestElementWithLanguageAttribute?.getAttribute('xml:lang') ??
    fallbackLocale;

  return activeLocaleCode;
};

export const addTabIndexToScrollableElements = (
  elements: ArrayLike<HTMLElement>,
): void => {
  Array.from(elements).forEach((element) => {
    const existingTabindex = element.getAttribute('tabindex');
    element.setAttribute('tabindex', existingTabindex || '0');
  });
};

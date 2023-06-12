import { TimelineData } from './TimelineData';
import { Translations } from './Translations';

export type Params = TimelineData & {
  behaviour?: {
    scalingMode: 'human' | 'cosmological' | 'index';
    initialZoom?: string | undefined;
  };

  l10n?: Translations;
  language?: string;
};

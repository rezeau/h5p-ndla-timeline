import { H5PAudio, H5PImage, H5PVideo } from 'h5p-types';

export type DescritionMediaType =
  | {
      descriptionMediaType: 'image';
      image?: H5PImage;
      imageAlt?: string;
    }
  | {
      descriptionMediaType: 'video';
      video?: Array<H5PVideo>;
    }
  | {
      descriptionMediaType: 'audio';
      audio?: Array<H5PAudio>;
    }
  | {
      descriptionMediaType: 'custom';
      customMedia?: string;
    }
  | {
      descriptionMediaType: 'none';
    };

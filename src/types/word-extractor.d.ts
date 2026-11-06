declare module "word-extractor" {
  class WordDocument {
    getText(): string;
  }

  export default class WordExtractor {
    extract(source: Buffer): Promise<WordDocument>;
  }
}

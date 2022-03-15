import streamSaver from './StreamSaver';

export class Save {
  get it() {
    return new Save();
  }

  as(url: string, name?: string) {
    const fileStream = streamSaver.createWriteStream(name, {
      size: 22, // (optional) 将会显示进度条
      writableStrategy: undefined, // (optional)
      readableStrategy: undefined, // (optional)
    });
  }
}

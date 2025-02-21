// rule-utils/src/config.ts
import { ContentType, Rule } from '../type';

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36 Edg/98.0.1108.50';

export const TAG = 'eso://';

export const DEFAULT_RULE: Omit<Rule, 'id' | 'createTime' | 'modifiedTime'> = {
  host: '',
  name: '',
  sort: 0,
  contentType: ContentType.NOVEL, // 默认小说类型
  loadJs: '',
  author: '',
  userAgent: '',
  enableSearch: false,
  searchUrl: '',
  searchList: '',
  searchCover: '',
  searchName: '',
  searchAuthor: '',
  searchChapter: '',
  searchDescription: '',
  searchResult: '',
  chapterUrl: '',
  chapterName: '',
  chapterList: '',
  chapterCover: '',
  chapterTime: '',
  chapterResult: '',
  contentItems: '',
  enableMultiRoads: false,
  chapterRoads: '',
  chapterNextUrl: '',
  enableDiscover: false,
  discoverUrl: '',
  discoverList: '',
  discoverName: '',
  discoverCover: '',
  discoverAuthor: '',
  discoverDescription: '',
  discoverResult: '',
  discoverTags: '',
  discoverChapter: '',
  discoverNextUrl: '',
  contentUrl: '',
  contentNextUrl: '',
  contentDecoder: '',
  enableUpload: false, // 默认值
  icon: '', // 默认值
  group: '',  //默认值
  useCryptoJS: false, //默认值
  searchTags: '',//默认值
  chapterRoadName: '',//默认值
  viewStyle: 0, //默认值
  cookies: '', //默认值
};
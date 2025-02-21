import { XMLParser } from 'fast-xml-parser';
import type { Rule } from '../type';
import { createRule } from './rule';
import { USER_AGENT } from './config';
import { NetworkManager, logger } from '@any-reader/utils';

const XML = new XMLParser({
  trimValues: true,
  textNodeName: 'type_name',
  ignoreAttributes: false,
  attributeNamePrefix: 'type_',
  parseAttributeValue: true,
});

// 提取为一个单独的函数
function buildDiscoverUrl(json: any, url: string): string {
  const u = new URL(url);
  return [
    '最近更新::/api.php/provide/vod?ac=detail&pg=$page',
    ...json.class.map(
      (row: any) =>
        `${row.type_name}::/api.php/provide/vod?ac=detail&pg=$page&t=${row.type_id}`,
    ),
  ].join('\n');
}

// 提取 chapterRoads 的 JS 代码
const chapterRoadsJs = `
  @js:(async()=>{\n
    json=[];\n
    $=JSON.parse(result).list[0];\n
    from=String($.vod_play_from).split('$$$');\n
    String($.vod_play_url).split('$$$').map((a,i)=>{\n
      //防止集数重复(判定链接)\n
      values = []\n
      function verify(){\n
        if( !/^\\s*$/.test(key) && value.length>19 ){\n
          let v = true\n
          values.map(url=>{\n
            if(  !/^\\s*$/.test(url) && value.match(new RegExp(url+'.*')) )v=false;\n
          });\n
          return v\n
        }\n
        return false\n
      }\n
      let list=[];\n
      a.split('#').map((a,i)=>{
        a=a.split('$');\n
        let key, value; // 声明 key, value
        if(a.length>1){\n
          key = /\\S/.test(a[0])?a[0]:i+1\n
          value = /^\\s*$/.test(a[1])?a[0]:a[1]\n
        } else {\n
          key = i+1\n
          value = a[0]\n
        }\n
        key = key.trim();\n
        if( verify() ){\n
          values.push(value.replace(/^.*\\/\\//,'').replace(/\\s*$/,'').replace(/\\?/g,'\\\\?'));\n
          list.push({'name':key,'url':value});\n
        }
      })\n
      //只保存有mp4/m3u8链接的线路\n
      if(/\\.(mp4|m3u8)/.test(list[0].url)){\n
        json.push({\n
          'roadName': from[i],\n
          'list': list,\n
        })\n
      }
    })\n
    return json\n
  })()`;

export function cmsToRule(json: any, url: string): Rule {
  const discoverUrl = buildDiscoverUrl(json, url);

  return createRule({
    name: '',
    host: new URL(url).origin,
    contentType: 2,
    enableDiscover: true,
    discoverUrl,
    discoverList: '$.list',
    discoverTags: '$.type_name&&$.vod_time## .*',
    discoverName: '$.vod_name',
    discoverCover: '$.vod_pic',
    discoverChapter: '$.vod_remarks||$.vod_state',
    discoverDescription: '$.vod_content##</?s?pa?n?.*?>',
    discoverResult: '$.vod_id',
    enableSearch: true,
    searchUrl: '/api.php/provide/vod?ac=detail&pg=$page&wd=$keyword',
    searchList: '$.list',
    searchTags: '$.type_name&&$.vod_time## .*',
    searchName: '$.vod_name',
    searchCover: '$.vod_pic',
    searchChapter: '$.vod_remarks||$.vod_state',
    searchDescription: '$.vod_content##</?s?pa?n?.*?>',
    searchResult: '$.vod_id',
    enableMultiRoads: true,
    chapterRoads: chapterRoadsJs,
    chapterRoadName: '$.roadName',
    chapterUrl: '/api.php/provide/vod?ac=detail&ids=$result',
    chapterList: '$.list',
    chapterName: '$.name',
    chapterResult: '$.url',
    contentUrl: 'null',
    contentItems: '@js:lastResult',
  });
}

async function cmsFetchAndParse(
  url: string,
  parser: (data: any) => any,
): Promise<Rule> {
  const networkManager = new NetworkManager();
  try {
    const response = await networkManager.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    const jsonData = parser(response.data);
    return cmsToRule(jsonData, url);
  } catch (error: any) {
    logger.error('网络请求失败:', { url, error: error.message, stack: error.stack });
    throw new Error(`网络请求失败: ${error.message}`, { cause: error }); // 抛出更详细的错误
  }
}

export async function cmsJsonToRule(url: string): Promise<Rule> {
  return cmsFetchAndParse(url, (data) => data);
}

export async function cmsXmlToRule(url: string): Promise<Rule> {
  return cmsFetchAndParse(url, (data) => {
    const jsonData = XML.parse(data as string).rss;
    jsonData.class = jsonData.class.ty;
    return jsonData;
  });
}
import NetworkUtils from './NetworkUtils';

const url = "https://chat.erojk.eu.org/#/chat";

try {
  const subDomain = NetworkUtils.getSubDomain(url);
  console.log(`子域名是: ${subDomain}`);
} catch (error) {
  console.error(`获取子域名出错: ${error}`);
}

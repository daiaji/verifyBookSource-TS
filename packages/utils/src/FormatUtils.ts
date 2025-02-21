export class Fmt {
  // 预编译正则表达式 (虽然提升可能不大，但符合最佳实践)
  private static readonly BOOK_NAME_REGEX: RegExp = new RegExp(/\s+作\s*者.*|\s+\S+\s+著/g);
  private static readonly AUTHOR_REGEX: RegExp = new RegExp(/^\s*作\s*者[:：\s]+|\s+著/g);
  private static readonly SPACE_REGEX: RegExp = new RegExp(/&nbsp;|&ensp;|&emsp;/g);
  private static readonly NO_PRINT_REGEX: RegExp = new RegExp(/&thinsp;|&zwnj;|&zwj;/g);
  private static readonly WRAP_HTML_REGEX: RegExp = new RegExp(/<\/?(?:div|p|br|hr|h\d|article|dd|dl)[^>]*>/g);
  private static readonly COMMENT_REGEX: RegExp = new RegExp(/<!--[^>]*-->/g);
  private static readonly INDENT1_REGEX: RegExp = new RegExp(/\s*\n+\s*/g); // 段缩进正则1
  private static readonly INDENT2_REGEX: RegExp = new RegExp(/^[\n\s]+/g); // 段缩进正则2
  private static readonly LAST_REGEX: RegExp = new RegExp(/[\n\s]+$/g); // 清理尾部空行
  // 将其他 HTML 标签的正则表达式也提取出来
  private static readonly OTHER_HTML_REGEX: RegExp = new RegExp(/<\/?[a-zA-Z]+(?=[ >])[^<>]*>/g);
  private static readonly SCRIPT_STYLE_REGEX: RegExp = new RegExp(/<script[^>]*>[\s\S]*?<\/script>|<style[^>]*>[\s\S]*?<\/style>/g);

  /**
   * 格式化书籍名称，去除作者信息。
   * @param text 原始书籍名称
   * @returns 格式化后的书籍名称
   */
  public static bookName(text: string): string {
    return text.replace(Fmt.BOOK_NAME_REGEX, '').trim();
  }

  /**
   * 格式化作者名称，去除多余的前缀和后缀。
   * @param text 原始作者名称
   * @returns 格式化后的作者名称
   */
  public static author(text: string): string {
    return text.replace(Fmt.AUTHOR_REGEX, '').trim();
  }

  /**
   * 格式化字数，将数字转换为更易读的格式（例如：12345 -> 1.2万字）。
   * @param text 原始字数（字符串或数字）
   * @returns 格式化后的字数
   */
  public static wordCount(text: string | number): string {
    if (!text) {
      return '';
    }

    let words: number;
    try {
      words = parseInt(String(text), 10);
      if (words > 10000) {
        return `${(words / 10000.0).toFixed(1)}万字`;
      } else {
        return `${words}字`;
      }
    } catch {
      return String(text); // 如果无法解析为数字，则返回原始字符串
    }
  }

  /**
   * 格式化 HTML 文本，去除不必要的标签和空白字符。
   * @param text 原始 HTML 文本
   * @param otherRegex 可选的正则表达式，用于匹配其他需要移除的 HTML 标签（默认为 OTHER_HTML_REGEX）
   * @returns 格式化后的纯文本
   */
  public static html(text: string, otherRegex: RegExp = Fmt.OTHER_HTML_REGEX): string {
    // 将常用的替换操作也提取成方法，提高可读性
    return Fmt.cleanHtml(text, otherRegex);
  }

  private static cleanHtml(text: string, otherRegex: RegExp): string {
    text = text.normalize('NFC'); // 使用 NFC 标准化
    text = text.replace(/\ufeff/g, ''); // 去除 BOM
    text = text.replace(/\u200b/g, ''); // 去除零宽空格
    text = text.replace(Fmt.SPACE_REGEX, ' ');      // 替换空格实体
    text = text.replace(Fmt.NO_PRINT_REGEX, '');   // 替换不可打印字符
    text = text.replace(Fmt.WRAP_HTML_REGEX, '\n'); // 替换换行标签
    text = text.replace(Fmt.COMMENT_REGEX, '');     // 移除注释
    text = text.replace(otherRegex, '');          // 移除其他 HTML 标签
    text = text.replace(Fmt.INDENT1_REGEX, '\n　　');  // 段落缩进
    text = text.replace(Fmt.INDENT2_REGEX, '　　');  // 段落缩进
    text = text.replace(Fmt.LAST_REGEX, '');      // 清理尾部空行
    return text;
  }
}
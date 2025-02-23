import { Element } from './Element';
import { $ } from './Jsoup';
import { AnyNode } from 'domhandler'; // 从 domhandler 导入 AnyNode

export class Elements extends Array {
  constructor(elements?: AnyNode[] | Elements | Element) { // 使用 AnyNode
    super();
    if (elements) {
      if (elements instanceof Elements) {
        this.push(...elements);
      } else if (elements instanceof Element) {
        this.push(elements);
      } else {
        this.push(...elements.map((el) => new Element(el)));
      }
    }
  }

  private getAnyNodes() {
    return Array.from(this).map((item: Element) => item.element);
  }

  attr(key: string): string {
    return $(this.getAnyNodes()).attr(key) ?? '';
  }

  children() {
    return new Elements($(this.getAnyNodes()).children().get());
  }

  select(cssQuery: string): Elements {
    return new Elements($(this.getAnyNodes()).find(cssQuery).get());
  }

  remove() {
    $(this.getAnyNodes()).remove();
  }

  clear() {
    this.length = 0;
  }

    addAll(items: AnyNode[] | Elements) {
        if (items instanceof Elements) {
            this.push(...items); // 直接 push Elements 的元素
        } else {
            // 使用 Array.from 确保 items 是数组
            this.push(...Array.from(items).map((el) => new Element(el)));
        }
    }

  outerHtml(): string {
    return $(this.getAnyNodes()).prop('outerHTML')!!;
  }
}
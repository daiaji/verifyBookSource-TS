import { AnyNode, Element as DomHandlerElement } from 'domhandler';
import { Elements } from './Elements';
import { $ } from './Jsoup';
import { handleError } from '@any-reader/legado'; // 导入 handleError

export class Element {
  element: AnyNode;
  constructor(element: AnyNode) {
    this.element = element;
  }

  attr(key: string) {
    return $(this.element).attr(key);
  }

  select(cssQuery: string): Elements {
    try {
      return new Elements($(this.element).find(cssQuery).get());
    } catch (e: any) {
      handleError('CSS selector 执行失败:', { cssQuery, error: e, stack: e.stack }, new Elements()); //补上error对象
      return new Elements(); // 返回空的 Elements 对象
    }
  }

  text() {
    return $(this.element).text();
  }

  ownText() {
    if (this.element.type === 'text') {
      return (this.element as unknown as Text).data;
    }

    const children = (this.element as DomHandlerElement).children;
    if (!children) {
      return '';
    }

    let text = '';
    for (const child of children) {
      if (child.type === 'text') {
        text += (child as unknown as Text).data;
      } else if ($(child).prop('tagName') === 'br') {
        text += ' '; // <br> 标签替换为空格
      }
    }

    return text.replace(/\s+/g, ' '); // 多个空格替换为一个
  }

  textNodes() {
    const textNodes = $(this.element)
      .contents()
      .filter((i, node) => {
        return node.type === 'text';
      })
      .get();
    return new Elements(textNodes);
  }
}
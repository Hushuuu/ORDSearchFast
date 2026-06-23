//import globalStyles from '../../css/styles.css' with { type: 'css' };
// 1. 建立一個繼承 HTMLElement 的類別
class MyNavbar extends HTMLElement {
  constructor() {
    super();
// 先不要使用 Shadow DOM
//     // 2. 建立 Shadow DOM 以隔離樣式與結構
//     this.attachShadow({ mode: 'open' });
//     this.shadowRoot.adoptedStyleSheets = [globalStyles];
    
//     // 3. 寫入樣式與 HTML 結構
//     this.shadowRoot.innerHTML = `
// <style>
// .nav-tabs {
//     display: flex;
//     gap: 10px;
//     flex-wrap: wrap;
// }

// .nav-link {
//     padding: 10px 16px;
//     border-radius: 999px;
//     border: 1px solid var(--border-color);
//     background: rgba(255, 255, 255, 0.04);
//     color: var(--text-color);
//     font-weight: 600;
// }

// .nav-link.active {
//     background: rgba(245, 158, 11, 0.18);
//     border-color: rgba(245, 158, 11, 0.45);
//     color: #ffd28a;
// }
// </style>
// <nav class="nav-tabs" aria-label="主要導覽">
//     <a class="nav-link" data-page="lookup" href="index.html">速查列表</a>
//     <a class="nav-link" data-page="tree" href="tree.html">合成樹</a>
//     <a class="nav-link" data-page="comp" href="comp.html">隊伍組成</a>
//     <a class="nav-link" data-page="recommend" href="recommend.html">合成推薦</a>
//     <a class="nav-link" style="display: none;" data-page="maintenance" href="maintenance.html">資料維護</a>
//     <a class="nav-link" target="_blank" href="https://ordsearch.net/mix">官網</a>
// </nav>
//     `;
  }
  connectedCallback(){
        this.innerHTML = `
<style>
.nav-tabs {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.nav-link {
    padding: 10px 16px;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-color);
    font-weight: 600;
}

.nav-link.active {
    background: rgba(245, 158, 11, 0.18);
    border-color: rgba(245, 158, 11, 0.45);
    color: #ffd28a;
}
</style>
<nav class="nav-tabs" aria-label="主要導覽">
    <a class="nav-link" data-page="lookup" href="index.html">速查列表</a>
    <a class="nav-link" data-page="tree" href="tree.html">合成樹</a>
    <a class="nav-link" data-page="comp" href="comp.html">隊伍組成</a>
    <a class="nav-link" data-page="comp_tree" href="comp_tree.html">我的隊伍</a>
    <a class="nav-link" data-page="recommend" href="recommend.html">合成推薦</a>
    <a class="nav-link" style="display: none;" data-page="maintenance" href="maintenance.html">資料維護</a>
    <a class="nav-link" target="_blank" href="https://ordsearch.net/mix">官網</a>
</nav>
    `;
  }
}

// 4. 將自訂元素註冊到瀏覽器中 (標籤名稱必須包含連字號 "-")
window.customElements.define('my-navbar', MyNavbar);

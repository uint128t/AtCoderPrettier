// ==UserScript==
// @name         AtCoder 美化
// @namespace    https://github.com/uint128t/LuoguRedirect
// @version      6.0
// @description  逻辑重构：区分原生浅色与交互浅色，实现“出身判定”，完美解决闪烁、卡死及恢复问题
// @author       uint128t
// @match        *://*.atcoder.jp/*
// @grant        GM_addStyle
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/uint128t/AtCoderPrettier/refs/heads/main/main.js
// @updateURL https://raw.githubusercontent.com/uint128t/AtCoderPrettier/refs/heads/main/main.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置区域 ---
    const imageUrl = "https://res.cloudinary.com/dtqp1ks3x/image/upload/v1771101741/Purple_Opaline_DM_ezg1t5.jpg";
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    const acrylicAlpha = isFirefox ? 0.4 : 0.6;

    const darkBgColor = "rgb(30, 30, 30)";
    const lightnessThreshold = 150;

    // --- 1. CSS 样式注入 ---
    // 这里的 CSS 只负责全局固定样式，不干预具体的按钮交互，留给 JS 去做智能判断
    GM_addStyle(`
        /* --- 全局背景 --- */
        body {
            background-image: url('${imageUrl}') !important;
            background-size: cover !important;
            background-position: center !important;
            background-attachment: fixed !important;
            background-repeat: no-repeat !important;
            color: #fff !important;
        }
        a { color: #90caf9 !important; }
        a:hover { color: #fff !important; }

        /* --- 布局透明化 --- */
        #main-div.float-container, #main-container.container {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
        }
        #main-container.container {
            width: 100% !important; max-width: 100% !important; margin: 0 !important;
            padding: 50px 120px !important; box-sizing: border-box !important;
        }
        div.container { margin-bottom: 0px !important; }

        /* --- 亚克力区域 (CSS 固定，JS跳过) --- */
        .navbar, div.row {
            backdrop-filter: blur(12px) saturate(100%) !important;
            -webkit-backdrop-filter: blur(12px) saturate(100%) !important;
            border: none !important;
            background-color: rgba(1, 1, 1, ${acrylicAlpha}) !important;
            color: #fff !important;
        }
        div.row { border-radius: 8px !important; margin-top: 30px !important; }

        /* --- 导航栏交互 --- */
        #contest-nav-tabs { background-color: transparent !important; border-radius: 8px 8px 0 0 !important; border: none !important; }
        #contest-nav-tabs.stuck-to-top { border-radius: 0 !important; background-color: rgba(16, 16, 16, 1) !important; }

        /* --- 表单与输入框 --- */
        input, textarea, select {
            background-color: #252525 !important;
            color: #fff !important;
            border-color: #444 !important;
        }

        /* --- 下拉菜单 --- */
        .dropdown-menu, .ui-menu { background-color: #1e1e1e !important; border: 1px solid #444 !important; }
        .dropdown-menu > li > a:hover { background-color: #333 !important; }

        /* --- 表格悬浮 (CSS 预处理) --- */
        .table-striped > tbody > tr:nth-of-type(odd):hover,
        .table-hover > tbody > tr:hover {
            background-color: rgba(50, 50, 50, 0.5) !important;
        }

        /* --- 状态颜色保护 --- */
        .label-success, .label-warning, .label-danger, .label-info,
        .accept, .wrong-answer { color: #fff !important; }
    `);

    // --- 2. JS 逻辑：智能颜色反转 ---

    function isLightColor(r, g, b) {
        return (r * 299 + g * 587 + b * 114) / 1000 > lightnessThreshold;
    }

    function parseColor(colorStr) {
        if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d\.]+))?\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: match[4] !== undefined ? parseFloat(match[4]) : 1
            };
        }
        return null;
    }

    /**
     * 核心处理函数
     * @param el 元素
     * @param isStaticCheck 是否为初始加载/新增节点 (决定是否打标记)
     */
    function processElement(el, isStaticCheck = false) {
        if (!el || el.nodeType !== 1) return;

        const tagName = el.tagName.toLowerCase();
        const className = el.className || "";

        // 1. 排除标签
        const skipTags = ['html', 'head', 'title', 'meta', 'link', 'style', 'script', 'img', 'svg', 'path', 'br', 'hr', 'i', 'input', 'textarea', 'select'];
        if (skipTags.includes(tagName)) return;

        // 2. 保护亚克力容器
        if (className.includes('navbar') || className.includes('row')) return;

        // 3. 保护状态标签
        if (["label-success", "label-warning", "label-danger", "label-info", "accept"].some(c => className.includes(c))) return;

        try {
            const style = window.getComputedStyle(el);
            const bgColor = style.backgroundColor;
            const rgb = parseColor(bgColor);

            if (rgb && isLightColor(rgb.r, rgb.g, rgb.b)) {
                // --- 应用深色样式 ---
                let newBg;
                if (rgb.a < 1) {
                    newBg = `rgba(30, 30, 30, ${rgb.a})`;
                } else {
                    newBg = darkBgColor;
                }

                el.style.setProperty('background-color', newBg, 'important');
                el.style.setProperty('border-color', '#444', 'important');
                el.style.setProperty('color', '#e0e0e0', 'important');

                // 核心：如果是静态检查（页面加载时），打上“出身浅色”的标记
                if (isStaticCheck) {
                    el.dataset.acOriginallyLight = "true";
                }
            }
        } catch (e) {}
    }

    // --- 3. 初始化与静态扫描 ---
    function scanAll(root = document.body) {
        const all = root.getElementsByTagName('*');
        for (let el of all) {
            processElement(el, true); // true = 静态检查，打标记
        }
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    processElement(node, true); // 新增节点视为静态检查
                    if (node.getElementsByTagName) scanAll(node);
                }
            });
            // 属性变化时，通常不需要重新打标记，只处理样式
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                 processElement(mutation.target, false);
            }
        });
    });

    // --- 4. 交互监听 ---

    // 鼠标移入：处理动态变化的浅色 (如 Hover 效果)
    document.addEventListener('mouseover', (e) => {
        processElement(e.target, false); // false = 动态交互，不打标记
    });

    // 鼠标移出：智能恢复逻辑
    document.addEventListener('mouseout', (e) => {
        const el = e.target;

        // 1. 防闪烁：如果鼠标还在元素内部(移到了子元素上)，不清理
        if (el.matches(':hover')) return;

        // 2. 核心逻辑：
        // 如果元素被标记为 "acOriginallyLight"，说明它原本就是浅色的，必须一直保持深色，不能清理。
        if (el.dataset && el.dataset.acOriginallyLight === "true") {
            return;
        }

        // 3. 恢复逻辑：
        // 如果走到这里，说明这个元素原本是深色的（比如深蓝按钮），只是因为 Hover 变白被 JS 强制改黑了。
        // 现在鼠标走了，应该移除 JS 样式，让它恢复原生的深色。
        if (el.style.backgroundColor) {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color');
            el.style.removeProperty('border-color');
        }
    });

    // --- 5. 启动 ---
    function init() {
        scanAll();
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
        handleScroll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function handleScroll() {
        const tabs = document.getElementById('contest-nav-tabs');
        const navbar = document.querySelector('.navbar');
        if (!tabs || !navbar) return;
        if (tabs.getBoundingClientRect().top <= navbar.offsetHeight + 2) {
            tabs.classList.add('stuck-to-top');
        } else {
            tabs.classList.remove('stuck-to-top');
        }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

})();

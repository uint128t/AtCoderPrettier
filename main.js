// ==UserScript==
// @name         AtCoder 美化
// @namespace    https://github.com/uint128t/AtCoderPrettier
// @version      6.1
// @description  逻辑重构：区分原生浅色与交互浅色，增加文字色相反转，完美解决闪烁及恢复问题
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
    const lightnessThreshold = 150; // 背景亮度阈值
    const textLightnessThreshold = 128; // 文字亮度阈值 (0-255)

    // --- 1. CSS 样式注入 ---
    GM_addStyle(`
        /* --- 全局背景 --- */
        body {
            background-image: url('${imageUrl}') !important;
            background-size: cover !important;
            background-position: center !important;
            background-attachment: fixed !important;
            background-repeat: no-repeat !important;
            color: #101010 !important;
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

    // --- 2. 辅助函数：颜色转换 ---

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

    // RGB 转 HSL
    function rgbToHsl(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // 灰度
        } else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return { h: h * 360, s: s, l: l };
    }

    // HSL 转 RGB
    function hslToRgb(h, s, l) {
        let r, g, b;
        h /= 360;

        if (s === 0) {
            r = g = b = l; // 灰度
        } else {
            function hue2rgb(p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            }
            let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            let p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }

    function isLightColor(r, g, b) {
        return (r * 299 + g * 587 + b * 114) / 1000 > lightnessThreshold;
    }

    // --- 3. 核心处理逻辑 ---

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

            // --- A. 背景处理 (原有逻辑) ---
            const bgColor = style.backgroundColor;
            const bgRgb = parseColor(bgColor);

            if (bgRgb && isLightColor(bgRgb.r, bgRgb.g, bgRgb.b)) {
                let newBg;
                if (bgRgb.a < 1) {
                    newBg = `rgba(30, 30, 30, ${bgRgb.a})`;
                } else {
                    newBg = darkBgColor;
                }
                el.style.setProperty('background-color', newBg, 'important');
                el.style.setProperty('border-color', '#444', 'important');
                // 注意：背景变深时，通常文字也需要调整，但这里先不强制，由下面的文字逻辑处理

                if (isStaticCheck) {
                    el.dataset.acOriginallyLight = "true";
                }
            }

            // --- B. 文字颜色处理 (新增逻辑) ---
            // 针对 span 或其他包含文字的元素，如果文字颜色过深，则提亮
            // 这里的逻辑是：无论背景如何，只要文字太暗（亮度低），就提亮它
            // 这样可以解决深色背景+深色文字的问题（虽然不常见，但逻辑更健壮）
            const color = style.color;
            const textRgb = parseColor(color);

            if (textRgb) {
                // 计算文字亮度 (0-1)
                const hsl = rgbToHsl(textRgb.r, textRgb.g, textRgb.b);

                // 如果亮度太低 (小于 0.5，即 128/255)，且不是纯白/浅色
                // 这里的 textLightnessThreshold 映射到 0-1 范围约为 0.5
                if (hsl.l < 0.5) {
                    // 提亮：保持色相 H 和 饱和度 S，将亮度 L 提升到 0.7 左右
                    // 这样深红变浅红，深蓝变浅蓝
                    const newL = 0.75;
                    const newRgb = hslToRgb(hsl.h, hsl.s, newL);

                    el.style.setProperty('color', `rgb(${newRgb.r}, ${newRgb.g}, ${newRgb.b})`, 'important');

                    // 打上标记，防止 mouseout 时被错误清除
                    // 注意：这个标记会与背景标记共存，需在 mouseout 中精细处理
                    if (isStaticCheck) {
                        el.dataset.acTextAdjusted = "true";
                    }
                }
            }

        } catch (e) {}
    }

    // --- 4. 初始化与静态扫描 ---
    function scanAll(root = document.body) {
        const all = root.getElementsByTagName('*');
        for (let el of all) {
            processElement(el, true);
        }
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    processElement(node, true);
                    if (node.getElementsByTagName) scanAll(node);
                }
            });
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                 processElement(mutation.target, false);
            }
        });
    });

    // --- 5. 交互监听 ---

    document.addEventListener('mouseover', (e) => {
        processElement(e.target, false);
    });

    document.addEventListener('mouseout', (e) => {
        const el = e.target;

        // 防闪烁：如果鼠标还在元素内部
        if (el.matches(':hover')) return;

        // 1. 如果元素原本背景就是浅色 (出身浅色)，永远不清理
        if (el.dataset && el.dataset.acOriginallyLight === "true") {
            return;
        }

        // 2. 如果元素仅仅是文字被调整过 (出身深色文字)，也不清理颜色
        //    这里的逻辑是：如果文字被提亮了，我们希望它保持提亮状态，不要恢复成深色看不见
        //    只有当元素是“背景交互”型（原本深色背景，hover变浅），才需要恢复背景
        if (el.dataset && el.dataset.acTextAdjusted === "true") {
             // 仅恢复背景和边框，保留文字颜色
             if (el.style.backgroundColor) {
                 el.style.removeProperty('background-color');
                 el.style.removeProperty('border-color');
             }
             return;
        }

        // 3. 完全恢复逻辑 (针对原本深色背景、深色文字，hover时变浅了的按钮等)
        if (el.style.backgroundColor) {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color'); // 这里可以安全移除 color，因为它是随 hover 临时改变的
            el.style.removeProperty('border-color');
        }
    });

    // --- 6. 启动 ---
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

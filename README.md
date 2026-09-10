# dsh-quick-toc

> [English](README.en.md) | **中文**

**DeepSeek Harness（DSH）对话大纲插件**：把 AI 回复中的 Markdown 标题（H1–H6）提取成可导航的大纲面板，按对话回合分组，自动跟随阅读位置，支持关键字搜索与对话内高亮定位。

## 功能

- **按回合分组** —— 每条用户消息 + 其后续 AI 回复为一组，组头显示该组最后一条消息的结束时间（附带该回合首行预览，点击可跳到回合开头）
- **关键字搜索** —— 标题栏放大镜打开搜索框，回车逐个定位（n/N 计数），Esc 关闭；支持 **标题 / 全文** 范围切换
- **对话内高亮** —— 命中关键字在对话中高亮，当前命中单独标亮并滚动到视口上方约 1/3 处；同一条消息内的多次命中都计入 n/N
- **自动跟随高亮** —— 滚动对话框时，视口内可见的回合在大纲中自动点亮（多组可同时点亮）；大纲自动加载并滚动，保证正在读的组始终可见
- **平滑跳转** —— 点击标题平滑滚动到对话中该标题的准确位置
- **可停靠、可缩放** —— 左右停靠（拖顶部横条移动）、边缘/角部拖拽调整大小、收起成可拖动的边缘把手；大小与位置自动记忆
- **分页渲染** —— 默认显示最近几组，大纲滚动到顶部自动加载更早的组
- **Markdown 清理** —— 标题中的 `**加粗**`、*斜体*、`` `代码` ``、`[链接](url)`、`~~删除线~~` 等行内标记自动剥离
- 对话无标题时自动隐藏；适配深色 / 浅色主题；内阴影卡片质感随主题切换（深色为白色高光）

## 兼容性

| 插件版本 | DSH 版本 |
| --- | --- |
| **0.3.2**（最新） | **≥ 0.1.2-rc.1**（已在 0.1.2-rc.1 / 0.1.5-rc.1 验证） |
| 0.3.0 – 0.3.1 | 同上 |
| 0.2.2 | 0.1.2-rc.1 之前的旧版 DSH（npm 上 `dsh-quick-toc@legacy`） |

0.3.0 重写了与宿主的对接（新版 slot 架构 + `useChat` 会话数据），**只支持 DSH 0.1.2-rc.1 及以上**；旧版 DSH 请安装 0.2.2。安装/更新时 DSH 市场会根据 package.json 的 `dsh.compatibility.dshReleases` 与 `peerDependencies` 做 host 兼容预检，版本不符会给出提示。

## 安装

通过 DSH CLI 安装（已发布 npm，只要名字）：

```
dsh plugin --profile web add dsh-quick-toc
```

或从 GitHub 安装：

```
dsh plugin --profile web add github:LyaxZ/dsh-quick-toc
```

或本地目录安装：

```
dsh plugin --profile web add <本目录路径>
```

重启 DSH（Windows 上双击 `restart-dsh.bat`）后打开 Web UI。大纲默认收起——点击对话区左侧边缘的小把手展开。

## 使用

- 点击大纲标题跳转到对话中对应位置
- 拖动顶部横条移动面板；点 **◀ / ▶** 按钮切换左右停靠
- 拖右边缘调宽度、下边缘调高度、右下角同时调
- 大纲滚动到顶部可加载更早的组

## 开发

- `lib/client.js` —— 全部 UI 逻辑（浏览器端）
- `lib/index.js` —— 宿主端空入口（版本守卫可在此扩展）
- `cordis.patch.yml` —— loader patch（符合官方 bundle 规范）
- **0.3.0 起对接新版插件模型**：面板注册进会话级 `conversation.input.overlay` 槽（会话级 hook 由 `ctx.uiSession.provide` 贡献，`useChat` 由 ui-chat 贡献），面板本体 `createPortal` 到 `document.body` 渲染成固定浮层；数据入口为 `props.useChat`（`ChatSnapshot.order` + `nodes`，节点形状：`kind: user/assistant-step`、`location.turn`、`data.blocks`）
- 改 client.js 后需重启 DSH（boot rev 按内容算）

## License

MIT © 2026 LyaxZ

# dsh-quick-toc

> [English](README.en.md) | **中文**

**DeepSeek Harness（DSH）对话大纲插件**：把 AI 回复中的 Markdown 标题（H1–H6）提取成可导航的大纲面板，按对话回合分组，自动跟随阅读位置。

## 功能

- **按回合分组** —— 每条用户消息 + 其后续 AI 回复为一组，组头显示该组最后一条消息的结束时间
- **自动跟随高亮** —— 滚动对话框时，视口内可见的回合在大纲中自动点亮（多组可同时点亮）；大纲自动加载并滚动，保证正在读的组始终可见
- **平滑跳转** —— 点击标题平滑滚动到对话中该标题的准确位置
- **可停靠、可缩放** —— 左右停靠（拖顶部横条移动）、边缘/角部拖拽调整大小、收起成可拖动的边缘把手；大小与位置自动记忆
- **滚动条跟随停靠方向** —— 停靠左侧时滚动条在左，停靠右侧时在右
- **分页渲染** —— 默认显示最近几组，大纲滚动到顶部自动加载更早的组
- **Markdown 清理** —— 标题中的 `**加粗**`、*斜体*、`` `代码` ``、`[链接](url)`、`~~删除线~~` 等行内标记自动剥离
- 对话无标题时自动隐藏；适配深色 / 浅色主题

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
- `lib/index.js` —— 宿主端空入口
- `cordis.patch.yml` —— loader patch（符合官方 bundle 规范）
- 改 client.js 后浏览器硬刷新即可生效；改 loader / patch 需重启 DSH

## License

MIT © 2026 LyaxZ

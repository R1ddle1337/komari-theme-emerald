<h3 align="center"> Komari Emerald </h3>
<p align="center">
基于 Vue 3 + Vite + reka-ui + Tailwind CSS v4 构建的 Komari Monitor 主题
</p>

![preview](/docs/preview.png)

## 2.2：简洁运维面板

- 浅色与深色使用统一的实色卡片和状态色，移除气泡、流体背景和毛玻璃开关。
- 首页提供资源概览、常驻搜索、地区与健康筛选，以及排序和密度切换。
- 节点卡片按资源、网络、三网延迟分区；离线时显示最后上报时间，不再模糊覆盖旧数据。
- 电信、联通、移动分别显示近 5 分钟平均延迟与丢包，支持切换地区及键盘打开各地对比。
- 地球仅在展开“节点分布”后加载，访客信息移至页尾，手机与桌面分别调整信息密度。
- 费用明细使用可聚焦、可用 Escape 关闭的弹层。预览图使用示例节点名称。

需要 Komari 2.0 的 `points_v1` 时序接口。旧版接口、算法及动态背景已退役。

## 使用

1. 从 [Release 页面](https://github.com/R1ddle1337/komari-theme-emerald/releases) 下载最新的 `komari-theme-emerald-build-*.zip` 文件
2. 登录 Komari Monitor 后，点击 `设置`，选择 `主题管理` 选项卡
3. 点击 `上传主题` 按钮，选择下载的 `komari-theme-emerald-build-*.zip` 文件
4. 刷新页面，即可看到新的主题

## 环境要求

- Node.js: `^20.19.0` 或 `>=22.12.0`
- Bun: `>=1.2.0`

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 代码检查
bun run lint
```

## 构建

```bash
# 类型检查 + 生产构建
bun run build

# 预览生产构建
bun run preview
```

## 技术栈

| 类别     | 技术                             |
| -------- | -------------------------------- |
| 框架     | Vue 3                            |
| 构建工具 | Vite 7                           |
| UI 组件  | reka-ui（shadcn-vue 风格组件）   |
| 样式方案 | Tailwind CSS v4 + tw-animate-css |
| 状态管理 | Pinia 3                          |
| 路由     | Vue Router 5                     |
| 提示系统 | vue-sonner（Toaster）            |
| 图标     | @iconify/vue                     |
| 图表     | vue-echarts                      |
| 3D 地球  | cobe                             |
| 实用工具 | @vueuse/core, dayjs              |
| 代码规范 | ESLint (@antfu/eslint-config)    |

## 鸣谢

- [Komari](https://github.com/komari-monitor/komari)
- [Komari Naive](https://github.com/tonyliuzj/komari-naive)
- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [reka-ui](https://reka-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

本主题基座基于 [Komari Naive](https://github.com/lyimoexiao/komari-theme-naive)，特此感谢

## License

[MIT](./LICENSE)

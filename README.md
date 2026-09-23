<h3 align="center"> Komari Emerald </h3>
<p align="center">
基于 Vue 3 + Vite + reka-ui + Tailwind CSS v4 构建的 Komari Monitor 主题
</p>

![preview](/docs/preview.png)

## 2.3.1：特色背景与三网趋势

- 保留 Emerald 气泡、流体 Shader，右上角可切换气泡 / 流体 / 纯色，支持背景强度调节并记住选择。
- 浅色与深色重新调整卡片层次、色彩和光影；搜索、健康筛选、排序、密度及置顶功能保持完整。
- 电信、联通、移动三条趋势图同时显示，共用纵轴刻度，可统一切换测点地区。数值是近 5 分钟成功探测均值，曲线展示近 30 分钟历史，红条代表丢包，缺测留空。
- 趋势使用一组共享的批量时序查询，每分钟更新；不为每个节点分别请求，也不在首页加载 ECharts。配对延迟与丢包样本后去除失败探测的 -1 贡献，避免把丢包当低延迟。
- 地球恢复原版浅色银白、深色蓝黑的材质与蓝色地区弧线，使用透明展示区；地区标签放在下方，保留拖拽、方向键及暂停旋转。地区弧线仅作分布展示，不代表实测网络连接。
- 后台标签页和不可见地球暂停绘制；低性能设备及减少动态效果偏好使用静态画面。背景只异步加载所选 Shader，保留自定义图片/视频。
- 预览图使用示例节点名称。需要 Komari 2.0 的 `points_v1` 时序接口。

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

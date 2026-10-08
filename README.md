# Autional 平台控制台

**域名**：[platform.autional.cn](https://platform.autional.cn)（cn）· [platform.autional.com](https://platform.autional.com)（com）
**技术栈**：Vite + React 19 + TypeScript + Tailwind CSS + Ant Design
**仓库**：[github.com/autional/platform](https://github.com/autional/platform)

平台级租户运营与全局配置。

## 开发

```bash
pnpm install
pnpm dev      # http://localhost:13110（构建前自动生成 env.js/robots.txt）
pnpm build    # 构建产物：apps/platform-console/dist/
pnpm test     # Vitest 单元测试
```

## 部署（单源双区）

`main` → `platform`（com）自动部署；`main` → `cn-platform`（cn）自动部署。两区**同一份源码**，
区域差异全部由 Vercel 项目环境变量在构建期注入（见 `docs/positioning/24`）：

| 变量 | com | cn |
| --- | --- | --- |
| `REGION` | `com` | `cn` |
| `SITE_URL` | `https://platform.autional.com` | `https://platform.autional.cn` |
| `DEFAULT_LANG` / `FALLBACK_LANG` | `en` | `zh` |
| `API_ORIGIN` | `https://api.autional.com` | `https://api.autional.cn` |
| `CDN_HOST` | `https://cdn.autional.com` | `https://cdn.autional.cn` |

- 路由/重写：`vercel.ts`（fail-closed：`API_ORIGIN` 缺失即构建失败）。
- 生成物（勿手改、勿入库）：`apps/platform-console/public/{env.js,robots.txt}` ← `scripts/gen-env.mjs`；区域文案在 `scripts/region-copy.mjs`。
- 本地无 env 时兜底 cn 值（与迁移前基线一致）。
- 生产构建另需 `VITE_GRAFANA_URL`（ops 页 iframe；缺失即 fail-build，PL-56）。

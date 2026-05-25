# 奶盖和年糕的 AI 成长日记

这个仓库现在是 `奶盖和年糕` 项目的主仓库。

它包含两部分：

- `web/`
  - 面向用户的内容网站，围绕奶盖和年糕的档案、日记、关于页来展开。
- `src/`
  - 早期搭建的 NestJS 后端骨架，保留了后续会员、云养宠、支付和后台能力的扩展基础。

同时，原本放在 `D:\AI\奶盖和年糕的成长日记` 的品牌内容库已经迁入当前仓库，作为网站和内容运营的统一素材源。

## 当前网站能力

- 首页：双主角故事化首屏
- `/about`：账号故事页
- `/profiles`：宠物档案总览
- `/profiles/[petId]`：单宠物详情页
- `/diary`：时间线归档页
- `/diary/[entryId]`：编辑型日记详情页

## 品牌内容库

迁移后的品牌资料在：

- `brand/naigai-niangao/`

其中包括：

- `source/`
  - 原始项目目录的完整拷贝
- `character-profile.md`
  - 角色设定与世界观
- `prompt-master.txt`
  - 统一画风提示词母版
- `first-five-video-scripts.txt`
  - 前 5 条短视频脚本

站点可直接使用的图片素材在：

- `web/public/brand/naigai-niangao/`

## 本地开发

```bash
npm install
npm run web:dev
npm run api:dev
```

本地地址：

- Web: `http://localhost:3001`
- API: `http://localhost:3000/api`

## 验证命令

```bash
npm run test:e2e
npm run build
npm run web:build
npm run prisma:validate
npm run prisma:generate
```

前端内容数据的快速验证：

```bash
node_modules\\.bin\\jest.cmd --runInBand web/app/content-site-data.spec.ts
node_modules\\.bin\\next.cmd build web
```

## 下一步方向

- 为日记页接入封面图与正文插图
- 增加更完整的内容运营页与素材管理约定
- 逐步把“云养宠”“会员页”“用户宠物主页”接到现有站点结构中
- 需要时再继续启用电商和后台能力

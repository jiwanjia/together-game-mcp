把最近已提交并验收的 PlayTogether 书柜、卧室三人走动/休息、三人衣柜及10%身高修正同步部署到现有 VPS 私人小屋。

- 授权来源：2026-10-30 月月请求同步/部署最近 PlayTogether 改动。
- 唯一游戏源码 D:/together-game-mcp/main；以2567234及本次必要兼容提交导出白名单，不读取未提交的旧双人休息/布局草稿作为发布源。旧dirty/私人参考原位保持。
- VPS沿原/srv/continuum/workspaces/.local/playtogether-release及原Flask容器/app/playtogether覆盖层，原登录/权限/端口/镜像/挂载保持，不安装、不删除、不新建服务。
- 必要兼容仅server-engine.js持久化/恢复原ReadingSession及三人气泡，frontend/playtogether-remote-room.js转发书柜页面动作并保留卧室本地接口。复用原规则，不新增共享卧室或共享衣柜、不扩展Hub工具清单。
- 比较现有发布文件hash，只发布差异及引用的已提交素材；既有已发布未跟踪人物图沿原部署副本复用。保存被覆盖文件供精确回退，临时产物只在.tmp，正式回退沿既有.local。
- 先验证规则与共享书柜状态恢复/邀请身份/双客户端/卧室路由；浏览器1280/390/320原页面及衣柜六套/卧室三人功能。再部署，核对宿主/两容器字节、受保护路由200/匿名401/私有路径404、原人物状态及10容器启动配置保持。正式房间不写验收动作，不请求模型。
- 原完成项的浏览器本地存储语义保持；Add a look不自动迁移本机私人素材到公网，不声称卧室或衣柜已跨设备共享。
- 精确提交并非强制push游戏main与HOME windows-current；共享适配文件按VPS vps-current正常同步提交push。只追加实际部署状态到原PROJECT_PLAN、HOME_MAP、todo、四段DEVLOG及docs/playtogether-home.md，检查FILE_INDEX/PROJECT_MAP实际变化。保留原dirty，不宣称全树clean。

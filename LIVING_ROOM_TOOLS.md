# 客厅陪玩动作

月月与哥哥在当前聊天对话交流；游戏不调用模型、不发聊天消息。哥哥通过现有浏览器工具调用当前页的 `TogetherHome` 接口，操作自己的角色。没有新增或登记独立MCP工具，也没有后台观察。

## 同一窗口

沿既有可见Chrome会话 `playtogether`，打开 `http://127.0.0.1:4173/#home`。月月直接操作这扇窗口，哥哥不要另开自己的游戏副本。

```powershell
& 'D:/tools/nodejs/playwright-cli.cmd' -s=playtogether eval 'TogetherHome.observe()'
& 'D:/tools/nodejs/playwright-cli.cmd' --% -s=playtogether eval "TogetherHome.act({action:'come'})"
& 'D:/tools/nodejs/playwright-cli.cmd' --% -s=playtogether eval "TogetherHome.act({action:'invite_follow'})"
& 'D:/tools/nodejs/playwright-cli.cmd' --% -s=playtogether eval "TogetherHome.act({action:'sit',seat:1})"
```

PowerShell动作调用使用`--%`保留JavaScript的引号；复杂调用可以写入临时run-code脚本后通过`--filename`调用，无需注册新工具。

## 参数与结果

| action | 参数 | 实际动作 |
| --- | --- | --- |
| observe | 无 | 只读观察角色位置、姿势、目标、占座、待办邀请、跟随状态与最近事件 |
| move | u,v（有限数） | 哥哥走到等距地面坐标；越界、家具内部及无法到达处明确失败 |
| come | 无 | 走到月月旁边的可走位置 |
| sit | seat:0/1/2 | 预订左／中／右座，走到座前再坐；占座冲突失败 |
| stand | 无 | 哥哥起身；跟随时月月一起起身 |
| face | 无 | 面向月月 |
| invite_follow | 无 | 弹出两分钟有效的邀请，返回awaiting_user和requestId；不会自动同意 |
| stop_follow | 无 | 结束一起行动，恢复月月自主操作 |

可选`revision`必须等于最近观察版本。`actor`只能省略或为`yan`；不能通过此接口移动月月或批准跟随。错误返回`ok:false,error`。动作成功返回`ok:true,status,state`，`started`只是开始行走；必须再次观察直到`posture`为standing或sitting，才算到达。

## 月月的控制与跟随

- 点地板或方向键移动；点沙发选座；点月月或起身按钮起身。需要走路时自动绕开茶几等家具。
- 点哥哥菜单留下come／sit邀请；请求保存在当前页状态，哥哥下次观察能看到；游戏不假称模型已收到，也不执行模型回复。
- 跟随只通过真实页面点击「跟着哥哥」批准。「先自己玩」、Escape、过期、离开家取消邀请；停止跟随、主动走动／选座／起身恢复自主操作。
- 已同意期间，哥哥move会安排月月到旁边的可走位置，哥哥sit会安排月月到空邻座。刷新不恢复旧同意或邀请。
- 切走页面或浏览器隐藏暂停动画；回到客厅恢复未完成动作。后台页不能发新的哥哥动作。

## 状态和素材

唯一事实源是当前页面Room实例，页面与哥哥接口共用；角色位置／坐姿保存到独立`playtogether-living-room-v1`。带`?preview`的页面只用sessionStorage，不写正式游戏存档。两人共玩同一扇窗口，不在多个标签同步或开启第二套服务。

素材是内置imagegen输出的空房间和三列透明姿势图，站立／迈步／坐下由CSS选择格子。哥哥与月月的已确认原形象是参考；原IMAGES与bedroom图片不移动、不覆盖。其他房间和屿的活动角色留待后续。

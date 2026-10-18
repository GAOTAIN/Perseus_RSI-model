# Perseus_RSI-model

基于 RSI 英仙座主题立绘制作的 VTube Studio 基础 Live2D 模型，目前为 v2 动作优化版。

![模型图标](Perseus_RSI/icon.png)

## 预览

![动作与物理演示](Preview/natural-v2.webp)

预览使用 20fps 的参数输入与官方 Cubism 物理算法驱动实际模型网格，不是摄像头实录。

## 模型内容

- 原生 Cubism 4.2 `.moc3` 运行模型、2048×2048 透明图集。
- 可编辑 `.cmo3`、绑定 JSON、脸部素材与重建脚本。
- 21 个参数：左右眼睑闭合、连续说话口型、头部 XYZ、身体跟随、呼吸、视线和眉形。
- 7 组物理：刘海以及左右侧发、长发与裙甲，各有不同的惯性节奏。
- 「冷傲」「自信」表情、10 秒待机动作与 RSI 官方标志图标。

## 在 VTube Studio 中使用

1. 下载本仓库并解压，把整个 `Perseus_RSI` 文件夹复制到 VTube Studio 的 `VTube Studio_Data/StreamingAssets/Live2DModels` 目录。
2. 启动 VTube Studio，选择 `Perseus_RSI`，首次加载执行 Auto-Setup，然后启用自己的摄像头并校准。
3. Windows 用户也可在关闭 VTS 后运行 `Install-Perseus.ps1 -VTubeStudioPath "你的 VTube Studio 安装目录"`。安装脚本会备份已有同名模型，并保留其摄像头校准与快捷键；它会设置图标并调整眼嘴输出范围和平滑。
4. 首次导入由 VTS 生成配置后，若图标未自动识别，关闭 VTS 后再运行一次安装脚本即可设置 `icon.png`。

[官方导入说明](https://github.com/DenchiSoft/VTubeStudio/wiki/Getting-Started#importing-a-live2d-model)

## 编辑与重建

- `Source/Perseus_RSI.cmo3`：模型源文件；已完成编码器加载回读检查，未做官方 Cubism Editor GUI 打开验证。
- `Source/rig.json` 和 `Source/Perseus_atlas.png`：可直接作为附带开源导出器的输入。
- 解压 `Source/Perseus_exporter_source.zip`，按包内说明用 JDK 21 构建；包含所用 Umamo 源码与许可证，不附带缓存或第三方模型。
- 重建素材：在 `Source/Build` 中安装 Node.js 依赖，再运行 `npm run art` 与 `npm run sidecars`。
- 口型纹理由内置 ImageGen 编辑，完整提示词见 `Source/ImageGen-v2-prompt.json`。

## 当前范围

这是主体连续网格加左右闭眼及口型贴片的基础二维绑定，共 4 个 ArtMesh；头发和装甲没有全部补绘为独立生产图层。转头是有限的二维透视形变，不包含完整侧脸、转身、手部动作或精细发丝分层。

模型通过官方 Live2D Core 5.0 的 MOC 一致性、真实加载、全部参数与参考渲染检查；物理使用官方 CubismWebFramework 执行验证。相机追踪表现仍取决于使用者设备和校准。验证记录见 `Validation/`。

## 来源

爱好者制作项目。RSI、Star Citizen 及相关标志属于其原权利人；本仓库不是官方模型。第三方素材与导出器信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

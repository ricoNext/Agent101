# 第 6 课：创建 Eval Dashboard 和自动化入口

> 所属章节：[第 6 章：Agent Eval、回归测试与质量改进](./index.md)  
> 上一课：[第 5 课：回归测试和版本对比](./lesson-39-regression-test-version-compare.md)

### 前端页面要求

创建 `/evals` 页面，至少显示：

- Golden Task 总数和分类；
- 当前版本与基线；
- 成功率、引用准确率、P95 和成本；
- 失败任务列表；
- 单任务 Trace；
- Judge 结果和人工复核状态；
- 是否满足发布门槛。

不要只画图而不显示样本。任何指标都应能点到具体失败任务。

### 自动化命令

定义统一入口：

```bash
python -m packages.evals.run --dataset packages/evals/golden_tasks.json --baseline baseline.json --output result.json
```

第七章会把该命令接入 CI。现在先保证本地可以重复运行并产生 JSON 报告。

### 第六章最终验收

- 有至少 20 个 Golden Tasks；
- 有规则评测、Trace 和 Judge 校准；
- 改动后可以生成版本对比；
- Eval Dashboard 能定位失败样本；
- 每个发布建议都包含质量、延迟、成本和安全信息；
- 生产失败可以被加入任务集。

### 进入第七章前的复盘

在 `docs/chapter-06-retrospective.md` 回答：

1. 为什么 Golden Task 不应该只保存标准答案？
2. 哪些质量问题可以用规则评测，哪些需要人工或 Judge？
3. 为什么成功率提高不一定等于候选版本更好？
4. 如何从 Trace 证明问题出在工具，而不是模型？
5. 新出现的生产失败如何变成长期质量资产？

第七章把这些评测、Trace 和版本结果带进真实部署、成本治理和灰度发布。

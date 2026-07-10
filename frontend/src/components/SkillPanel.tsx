import { useState, useEffect } from 'react';
import { Wand2, ChevronDown, ChevronUp, Play, DollarSign, AlertCircle } from 'lucide-react';
import { listSkills, executeSkill, executeSkillStep, SkillInfo, SkillExecuteResult } from '../api/ai';

interface SkillPanelProps {
  title: string;
  content: string;
  outline: string;
  onResult: (output: string, outline?: string) => void;
}

export default function SkillPanel({ title, content, outline, onResult }: SkillPanelProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [expandedSkill, setExpandedSkill] = useState<string>('');
  const [extra, setExtra] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SkillExecuteResult | null>(null);
  const [currentStep, setCurrentStep] = useState('');
  const [stepOutput, setStepOutput] = useState('');
  const [costTotal, setCostTotal] = useState(0);

  useEffect(() => {
    listSkills().then(res => setSkills(res.data.skills));
  }, []);

  const skillLabels: Record<string, string> = {
    'paper-outline': '📋 生成大纲',
    'paper-draft': '✍️ 起草章节',
    'paper-revise': '🔧 修改论文',
    'paper-polish': '✨ 润色文本',
    'paper-review': '🔍 投稿前审查',
    'paper-defense': '🎤 答辩准备',
  };

  const skillDescriptions: Record<string, string> = {
    'paper-outline': '基于题目生成 3 级大纲 + 每节写作要点',
    'paper-draft': '基于大纲逐节起草初稿，控制上下文',
    'paper-revise': '解析导师反馈，生成多方案可选修改',
    'paper-polish': '学术风格润色，保持术语一致',
    'paper-review': '多维度并行审查：结构、论证、格式、语言',
    'paper-defense': '提取贡献 + PPT 大纲 + 预判评审问题',
  };

  const handleFullExecute = async () => {
    if (!selectedSkill) return;
    setLoading(true);
    setResult(null);
    setCostTotal(0);
    try {
      const res = await executeSkill({
        skill: selectedSkill,
        title,
        content,
        outline,
        extra,
      });
      setResult(res.data);
      setCostTotal(res.data.estimated_cost_usd);
      onResult(res.data.output, res.data.skill === 'paper-outline' ? res.data.output : undefined);
    } catch (e: any) {
      alert('执行失败: ' + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleStepByStep = async () => {
    if (!selectedSkill) return;
    const skill = skills.find(s => s.name === selectedSkill);
    if (!skill || skill.steps.length === 0) return;

    setLoading(true);
    setCurrentStep('');
    setStepOutput('');
    setCostTotal(0);

    try {
      for (const step of skill.steps) {
        setCurrentStep(step.name);
        const res = await executeSkillStep({
          skill: selectedSkill,
          step_name: step.name,
          title,
          content: stepOutput || content,
          outline,
          extra,
        });
        setStepOutput(res.data.output);
        setCostTotal(prev => prev + res.data.estimated_cost_usd);
      }
      // 全部步骤完成
      setResult({
        success: true,
        skill: selectedSkill,
        steps_completed: skill.steps.map(s => s.name),
        output: stepOutput,
        estimated_cost_usd: costTotal,
        estimated_tokens: 0,
        warnings: [],
      });
      onResult(stepOutput, selectedSkill === 'paper-outline' ? stepOutput : undefined);
    } catch (e: any) {
      alert(`步骤 "${currentStep}" 失败: ` + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
      setCurrentStep('');
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow space-y-3">
      <h3 className="font-bold text-lg flex items-center gap-2">
        <Wand2 size={18} className="text-indigo-600" />
        AI 写作助手
      </h3>

      {/* Skill 选择器 */}
      <div className="space-y-1">
        <label className="text-xs text-gray-500 font-medium">选择工作流</label>
        <div className="grid grid-cols-1 gap-1.5">
          {skills.map(skill => (
            <div key={skill.name}>
              <button
                onClick={() => {
                  setSelectedSkill(skill.name);
                  setExpandedSkill(expandedSkill === skill.name ? '' : skill.name);
                  setResult(null);
                }}
                className={`w-full text-left p-2 rounded text-sm transition-colors ${
                  selectedSkill === skill.name
                    ? 'bg-indigo-50 border border-indigo-200 ring-1 ring-indigo-300'
                    : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{skillLabels[skill.name] || skill.name}</span>
                  {expandedSkill === skill.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>
              {expandedSkill === skill.name && (
                <div className="ml-2 mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600 space-y-1">
                  <p className="font-medium text-gray-700">{skillDescriptions[skill.name]}</p>
                  <p>步骤数：{skill.steps.length} 步</p>
                  <div className="space-y-0.5 mt-1">
                    {skill.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-gray-500">
                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-center text-[10px] leading-4 font-bold">{i + 1}</span>
                        {step.name} — <span className="text-gray-400">{step.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 额外输入 */}
      {selectedSkill && (
        <div>
          <label className="text-xs text-gray-500 font-medium">
            {selectedSkill === 'paper-revise' ? '导师/审稿人反馈' :
             selectedSkill === 'paper-polish' ? '润色风格（默认：学术）' :
             selectedSkill === 'paper-outline' ? '补充要求（可选）' : '额外说明（可选）'}
          </label>
          <textarea
            value={extra}
            onChange={e => setExtra(e.target.value)}
            className="w-full h-16 border p-2 rounded text-sm mt-1"
            placeholder={selectedSkill === 'paper-revise' ? '粘贴导师的反馈意见...' : '输入额外的要求或说明...'}
          />
        </div>
      )}

      {/* 执行按钮 */}
      {selectedSkill && (
        <div className="flex gap-2">
          <button
            onClick={handleFullExecute}
            disabled={loading}
            className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loading ? '执行中...' : <><Play size={14} /> 一键执行</>}
          </button>
          <button
            onClick={handleStepByStep}
            disabled={loading}
            className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200 disabled:opacity-50"
          >
            逐步执行
          </button>
        </div>
      )}

      {/* 当前步骤 */}
      {currentStep && (
        <div className="bg-blue-50 p-2 rounded text-sm text-blue-700 animate-pulse">
          正在执行：{currentStep}...
        </div>
      )}

      {/* 结果摘要 */}
      {result && (
        <div className="bg-green-50 p-3 rounded text-sm space-y-1">
          <p className="font-medium text-green-800">✅ 执行完成</p>
          <p className="text-green-700">完成步骤：{result.steps_completed.join(' → ')}</p>
          <p className="text-green-700 flex items-center gap-1">
            <DollarSign size={14} />
            预估成本：${result.estimated_cost_usd.toFixed(4)} USD
          </p>
          <p className="text-green-600 text-xs">
            预估 token：{result.estimated_tokens.toLocaleString()}
          </p>
          {result.warnings.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-amber-600 flex items-center gap-1 text-xs">
                  <AlertCircle size={12} /> {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 快速操作（始终可用） */}
      <div className="border-t pt-2 mt-2">
        <p className="text-xs text-gray-400 mb-1.5">快速操作（点击直接执行）</p>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => {
              setSelectedSkill('paper-outline');
              handleFullExecute();
            }}
            className="text-xs bg-gray-50 hover:bg-gray-100 p-1.5 rounded text-left"
          >
            📋 生成大纲
          </button>
          <button
            onClick={() => {
              setSelectedSkill('paper-polish');
              handleFullExecute();
            }}
            className="text-xs bg-gray-50 hover:bg-gray-100 p-1.5 rounded text-left"
          >
            ✨ 润色
          </button>
          <button
            onClick={() => {
              setSelectedSkill('paper-review');
              handleFullExecute();
            }}
            className="text-xs bg-gray-50 hover:bg-gray-100 p-1.5 rounded text-left"
          >
            🔍 审查
          </button>
          <button
            onClick={() => {
              setSelectedSkill('paper-draft');
              handleFullExecute();
            }}
            className="text-xs bg-gray-50 hover:bg-gray-100 p-1.5 rounded text-left"
          >
            ✍️ 续写
          </button>
        </div>
      </div>
    </div>
  );
}

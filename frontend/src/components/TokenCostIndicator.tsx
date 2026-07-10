import { useState, useEffect } from 'react';
import { DollarSign, BarChart3 } from 'lucide-react';
import { listModels, ModelInfo } from '../api/ai';

export default function TokenCostIndicator() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    listModels().then(res => setModels(res.data.models)).catch(() => {});
  }, []);

  const tierColors: Record<string, string> = {
    budget: 'bg-green-100 text-green-700',
    standard: 'bg-blue-100 text-blue-700',
    premium: 'bg-purple-100 text-purple-700',
    elite: 'bg-amber-100 text-amber-700',
  };

  const tierLabels: Record<string, string> = {
    budget: '省钱',
    standard: '标准',
    premium: '高级',
    elite: '顶级',
  };

  return (
    <div className="bg-white p-3 rounded shadow text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-gray-600 hover:text-gray-800"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <BarChart3 size={14} />
          模型与成本
        </span>
        <span className="text-xs text-gray-400">{expanded ? '收起' : '展开'}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {models.map(m => (
            <div key={m.name} className="flex items-center justify-between text-xs p-1.5 bg-gray-50 rounded">
              <div className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tierColors[m.tier] || 'bg-gray-100'}`}>
                  {tierLabels[m.tier] || m.tier}
                </span>
                <span className="font-medium">{m.name}</span>
                {!m.available && <span className="text-red-400">未配置</span>}
              </div>
              <div className="text-gray-400 flex items-center gap-0.5">
                <DollarSign size={10} />
                <span>${m.cost_per_1k_input.toFixed(4)} / 1k in</span>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-400 mt-1">
            💡 提示：配置多个 API Key 可启用自动省钱路由（见 .env.example）
          </p>
        </div>
      )}
    </div>
  );
}

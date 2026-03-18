"use client";

import { Card } from "@/components/ui/card";
import type { IdeaProposal } from "@/lib/types";

interface IdeaCardProps {
  idea: IdeaProposal;
}

export function IdeaCard({ idea }: IdeaCardProps) {
  return (
    <div className="space-y-4">
      {/* Main idea header */}
      <Card className="p-0 overflow-hidden border-brand/30">
        {/* Gradient banner */}
        <div className="bg-gradient-to-r from-brand via-accent-blue to-accent-cyan p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.08%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white/80 mb-3">
              🤖 AI Tarafından Üretildi
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">{idea.appName}</h2>
            <p className="text-white/80 text-sm">{idea.tagline}</p>
          </div>
        </div>

        <div className="p-6">
          <p className="text-content-secondary leading-relaxed">
            {idea.description}
          </p>
        </div>
      </Card>

      {/* Features grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Features */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-content mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-brand-subtle flex items-center justify-center text-xs">✨</span>
            Özellikler
          </h3>
          <ul className="space-y-2">
            {idea.features.map((feature, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-content-secondary"
              >
                <span className="text-success mt-0.5">●</span>
                {feature}
              </li>
            ))}
          </ul>
        </Card>

        {/* Tech Stack */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-content mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-xs">🛠️</span>
            Teknolojiler
          </h3>
          <div className="flex flex-wrap gap-2">
            {idea.techStack.map((tech, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-lg bg-surface-tertiary px-3 py-1.5 text-xs text-content-secondary border border-edge"
              >
                {tech}
              </span>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-content mt-5 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-xs">🎯</span>
            Hedef Kitle
          </h3>
          <p className="text-sm text-content-secondary">
            {idea.targetAudience}
          </p>
        </Card>

        {/* Monetization */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-content mb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-xs">💰</span>
            Gelir Modeli
          </h3>
          <p className="text-sm text-content-secondary">
            {idea.monetization}
          </p>
        </Card>

        {/* Unique Value */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-content mb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center text-xs">💎</span>
            Fark & Değer
          </h3>
          <p className="text-sm text-content-secondary">
            {idea.uniqueValue}
          </p>
        </Card>
      </div>
    </div>
  );
}

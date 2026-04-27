"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AppPreviewProps {
    url: string;
    appName?: string;
}

/**
 * AppPreview
 *
 * Embeds the deployed/running generated app in an iframe so the user can
 * interact with it directly from the run detail page. Falls back to a
 * "open in new tab" link if the target site forbids framing.
 *
 * Used by the run detail page for any run that has either a freshly returned
 * URL from /api/runs/[id]/run or a previously-saved deployUrl on the run
 * (read from deploy/deploy-result.json by file-utils).
 */
export function AppPreview({ url, appName }: AppPreviewProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

  return (
        <Card className="p-0 overflow-hidden border-emerald-500/30">
              <div className="flex items-center justify-between px-4 py-2 border-b border-edge bg-surface-tertiary">
                      <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                                <span className="text-sm font-medium text-content truncate">
                                  {appName ? `${appName} - canli onizleme` : "Canli onizleme"}
                                </span>span>
                                <a
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="ml-2 text-xs text-content-muted hover:text-content truncate"
                                            >
                                  {url}
                                </a>a>
                      </div>div>
                      <div className="flex items-center gap-2">
                                <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => setReloadKey((k) => k + 1)}
                                            >
                                            Yenile
                                </Button>Button>
                                <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => window.open(url, "_blank", "noopener")}
                                            >
                                            Yeni sekme
                                </Button>Button>
                                <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => setCollapsed((c) => !c)}
                                            >
                                  {collapsed ? "Goster" : "Gizle"}
                                </Button>Button>
                      </div>div>
              </div>div>
          {!collapsed && (
                  <div className="bg-black/40">
                            <iframe
                                          key={reloadKey}
                                          src={url}
                                          title={appName ? `${appName} preview` : "App preview"}
                                          className="w-full h-[700px] border-0 bg-white"
                                          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads"
                                          referrerPolicy="no-referrer"
                                          loading="lazy"
                                        />
                  </div>div>
              )}
        </Card>Card>
      );
}
</Card>

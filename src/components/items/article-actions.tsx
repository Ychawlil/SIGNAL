"use client";
import { useState } from "react";
import { ArticlePreviewButton } from "./article-preview-button";
import { useLibrary } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "./favorite-button";
import { ImportanceMeter } from "./meta";
export function ArticleActions({ id, score }: { id: number; score: number }) {
 const { isRead, toggleRead, addToQueue } = useLibrary(); const [notice, setNotice] = useState("");
 return <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3"><ImportanceMeter articleId={String(id)} score={score} /><FavoriteButton id={String(id)} size="sm" /><Button size="sm" variant="ghost" onClick={() => toggleRead(String(id))}>{isRead(String(id)) ? "标记未读" : "标记已读"}</Button><Button size="sm" variant="ghost" onClick={() => { void addToQueue(String(id)).then(() => setNotice("已加入稍后阅读")).catch(() => setNotice("加入失败，请重试")); }}>稍后阅读</Button><ArticlePreviewButton id={id} className="ml-auto text-xs text-accent hover:underline">详情与导出 →</ArticlePreviewButton>{notice && <p role="status" className="w-full text-xs text-muted-foreground">{notice}</p>}</div>;
}

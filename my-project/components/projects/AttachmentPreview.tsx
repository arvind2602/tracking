'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, FileCode, FileText, FileSpreadsheet, Image as ImageIcon, Music, Video, FileQuestion, Trash2, Loader } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getProxiedImageUrl } from '@/lib/imageProxy';

export interface PreviewAttachment {
  id?: string;
  name: string;
  url: string;
  fileType?: string | null;
  size?: number | null;
  heading?: string | null;
}

export type AttachmentKind = 'image' | 'pdf' | 'video' | 'audio' | 'office' | 'text' | 'other';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
const OFFICE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'];
const TEXT_EXTS = ['txt', 'csv', 'md', 'markdown', 'json', 'log', 'xml', 'tsv', 'yaml', 'yml'];

const OFFICE_MIMES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
];

// fileType is the stored MIME type; fall back to the file extension for rows
// saved before fileType existed (or by integrations that omit it).
export function attachmentKind(att: Pick<PreviewAttachment, 'name' | 'fileType'>): AttachmentKind {
  const mime = (att.fileType || '').toLowerCase();
  const ext = (att.name.split('.').pop() || '').toLowerCase();

  if (mime.startsWith('image/') || IMAGE_EXTS.includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('video/') || VIDEO_EXTS.includes(ext)) return 'video';
  if (mime.startsWith('audio/') || AUDIO_EXTS.includes(ext)) return 'audio';
  if (OFFICE_MIMES.includes(mime) || OFFICE_EXTS.includes(ext)) return 'office';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' || TEXT_EXTS.includes(ext)) return 'text';
  return 'other';
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${unit === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

const KIND_ICONS: Record<AttachmentKind, typeof FileText> = {
  image: ImageIcon,
  pdf: FileText,
  video: Video,
  audio: Music,
  office: FileSpreadsheet,
  text: FileCode,
  other: FileQuestion,
};

// Human label — office formats get a precise one based on the extension.
export function attachmentLabel(att: PreviewAttachment): string {
  const kind = attachmentKind(att);
  const ext = (att.name.split('.').pop() || '').toLowerCase();
  if (kind === 'office') {
    if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'Word document';
    if (['xls', 'xlsx', 'ods'].includes(ext)) return 'Excel spreadsheet';
    if (['ppt', 'pptx', 'odp'].includes(ext)) return 'PowerPoint presentation';
    return 'Office document';
  }
  if (kind === 'image') return 'Image';
  if (kind === 'pdf') return 'PDF document';
  if (kind === 'video') return 'Video';
  if (kind === 'audio') return 'Audio';
  if (kind === 'text') return 'Text file';
  return 'File';
}

export function AttachmentThumbnail({ attachment, size = 40 }: { attachment: PreviewAttachment; size?: number }) {
  const kind = attachmentKind(attachment);
  const Icon = KIND_ICONS[kind];

  if (kind === 'image') {
    return (
      <img
        src={`${getProxiedImageUrl(attachment.url)}&w=200`}
        alt=""
        loading="lazy"
        style={{ width: size, height: size }}
        className="rounded-md object-cover border border-indigo-500/20 bg-indigo-500/10 shrink-0"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0"
    >
      <Icon className="text-indigo-600" style={{ width: size * 0.45, height: size * 0.45 }} aria-hidden="true" />
    </div>
  );
}

// Office documents can't be rendered in-browser without a service — these two
// public viewers fetch the (public) Cloudinary URL and render it.
const officeViewerUrl = (provider: 'office' | 'google', url: string) =>
  provider === 'office'
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
    : `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

function TextViewer({ attachment }: { attachment: PreviewAttachment }) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setHasError(false);
    setContent(null);

    fetch(attachment.url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(text => {
        if (cancelled) return;
        setContent(text.length > 200_000 ? `${text.slice(0, 200_000)}\n… (preview truncated)` : text);
      })
      .catch(() => { if (!cancelled) setHasError(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [attachment.url]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader className="h-4 w-4 animate-spin" /> Loading preview…
      </div>
    );
  }

  if (hasError || content === null) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 px-6 text-center">
        <p className="text-sm font-semibold">Couldn&apos;t load the text preview</p>
        <p className="text-xs text-muted-foreground">The file may block cross-origin reads. Use “Open in new tab”.</p>
      </div>
    );
  }

  return (
    <pre className="w-full max-h-[60vh] overflow-auto p-4 text-xs font-mono text-left whitespace-pre-wrap break-words select-text">
      {content}
    </pre>
  );
}

export function AttachmentPreviewDialog({
  attachment,
  onClose,
  onDelete,
  isDeleting,
}: {
  attachment: PreviewAttachment | null;
  onClose: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}) {
  const kind = attachment ? attachmentKind(attachment) : 'other';
  const [officeViewer, setOfficeViewer] = useState<'office' | 'google'>('office');
  const meta = attachment
    ? [attachmentLabel(attachment), formatBytes(attachment.size), attachment.heading || null].filter(Boolean).join(' · ')
    : '';

  // Reset to the default viewer whenever a different file is opened
  useEffect(() => { setOfficeViewer('office'); }, [attachment?.url]);

  return (
    <Dialog open={!!attachment} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl bg-card border-border p-6 shadow-2xl">
        {attachment && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="text-lg font-bold tracking-tight break-words">{attachment.name}</DialogTitle>
              <DialogDescription>{meta}</DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden flex flex-col items-center justify-center min-h-[240px]">
              {kind === 'image' && (
                <img
                  src={`${getProxiedImageUrl(attachment.url)}&w=1600`}
                  alt={attachment.name}
                  className="max-h-[60vh] w-auto object-contain"
                />
              )}
              {kind === 'pdf' && (
                <iframe
                  src={`${attachment.url}#toolbar=0&navpanes=0`}
                  title={`Preview of ${attachment.name}`}
                  className="w-full h-[65vh] bg-white"
                />
              )}
              {kind === 'video' && (
                <video src={attachment.url} controls className="max-h-[60vh] w-full bg-black">
                  Your browser does not support embedded video.
                </video>
              )}
              {kind === 'audio' && <audio src={attachment.url} controls className="w-full p-6" />}
              {kind === 'office' && (
                <div className="w-full">
                  <div className="flex items-center justify-center gap-2 px-3 py-2 border-b border-border/60 bg-background/60">
                    <span className="text-[11px] text-muted-foreground">Rendered by</span>
                    <button
                      type="button"
                      onClick={() => setOfficeViewer('office')}
                      className={`text-[11px] font-bold px-2 py-1 rounded-md transition-colors ${officeViewer === 'office' ? 'bg-indigo-500/15 text-indigo-600' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      Microsoft Office
                    </button>
                    <button
                      type="button"
                      onClick={() => setOfficeViewer('google')}
                      className={`text-[11px] font-bold px-2 py-1 rounded-md transition-colors ${officeViewer === 'google' ? 'bg-indigo-500/15 text-indigo-600' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      Google Docs
                    </button>
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">— the file URL is shared with this viewer</span>
                  </div>
                  <iframe
                    key={officeViewer}
                    src={officeViewerUrl(officeViewer, attachment.url)}
                    title={`Preview of ${attachment.name}`}
                    className="w-full h-[62vh] bg-white"
                  />
                </div>
              )}
              {kind === 'text' && <TextViewer attachment={attachment} />}
              {kind === 'other' && (
                <div className="flex flex-col items-center gap-3 py-14 px-6 text-center">
                  <div className="h-14 w-14 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <FileQuestion className="h-7 w-7 text-indigo-500" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold">No inline preview for this file type</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Open it in a new tab to view or download it.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-3 sm:justify-between">
              {onDelete ? (
                <Button
                  variant="outline"
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="gap-2 font-bold border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                >
                  {isDeleting ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground self-center break-all text-left">
                  {attachment.url.replace(/^https?:\/\//, '').slice(0, 60)}…
                </span>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="font-bold">Close</Button>
                <Button asChild className="gap-2 font-bold">
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                    Open in new tab <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

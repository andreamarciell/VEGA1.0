import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Paperclip, File, Clock, User, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ActivityLog {
  id: string;
  activity_type: 'comment' | 'status_change' | 'auto_retrigger' | 'attachment';
  content: string | null;
  old_status: string | null;
  new_status: string | null;
  created_by: string | null;
  created_at: string;
  metadata: any;
}

const statusLabels: Record<string, string> = {
  'active': 'Attivo',
  'high-risk': 'High Risk',
  'critical-risk': 'Critical Risk',
  'reviewed': 'Revisionato',
  'escalated': 'Escalato',
  'archived': 'Archiviato'
};

export default function CommentsTab({ accountId }: { accountId: string }) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [comment, setComment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string>('active');

  // Carica attività e status corrente
  useEffect(() => {
    loadActivities();
    loadCurrentStatus();
  }, [accountId]);

  const loadCurrentStatus = async () => {
    try {
      const response = await fetch(`/.netlify/functions/getPlayersList`);
      const data = await response.json();
      const player = data.players?.find((p: any) => p.account_id === accountId);
      if (player) {
        setCurrentStatus(player.status || 'active');
        setSelectedStatus(player.status || 'active');
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const loadActivities = async () => {
    setIsLoadingActivities(true);
    try {
      const response = await fetch(`/.netlify/functions/getPlayerActivityLog?account_id=${accountId}`);
      const data = await response.json();
      if (data.success) {
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      toast.error('Errore nel caricare le attività');
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) {
      toast.error('Inserisci un commento');
      return;
    }

    setIsLoading(true);
    try {
      // Upload attachments se presenti (per ora salva solo i nomi, implementare upload a Supabase Storage)
      const attachmentUrls: string[] = [];
      for (const file of attachments) {
        // TODO: Implementare upload a Supabase Storage
        // const url = await uploadToStorage(file, accountId);
        // attachmentUrls.push(url);
        attachmentUrls.push(file.name); // Placeholder
      }

      const response = await fetch('/.netlify/functions/addPlayerComment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          content: comment,
          attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setComment('');
        setAttachments([]);
        toast.success('Commento aggiunto');
        loadActivities();
      } else {
        throw new Error(result.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Errore nell\'aggiungere il commento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;

    setIsLoading(true);
    try {
      const response = await fetch('/.netlify/functions/updatePlayerStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          status: newStatus
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setCurrentStatus(newStatus);
        toast.success(`Status cambiato in ${statusLabels[newStatus]}`);
        loadActivities();
        loadCurrentStatus();
      } else {
        throw new Error(result.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Errore nel cambiare lo status');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return <MessageSquare className="h-4 w-4" />;
      case 'status_change':
        return <ArrowRight className="h-4 w-4" />;
      case 'auto_retrigger':
        return <Clock className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'comment':
        return 'text-blue-600';
      case 'status_change':
        return 'text-green-600';
      case 'auto_retrigger':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Form per aggiungere commento */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Aggiungi commento</h3>
        <div className="space-y-4">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Scrivi un commento..."
            rows={4}
            className="resize-none"
          />
          <div className="flex items-center gap-4">
            <label htmlFor="file-input" className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary">
              <Paperclip className="h-4 w-4" />
              <input
                type="file"
                multiple
                onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                className="hidden"
                id="file-input"
              />
              <span>Allegati ({attachments.length})</span>
            </label>
            {attachments.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {attachments.map((file, idx) => (
                  <span key={idx} className="text-xs bg-muted px-2 py-1 rounded">
                    {file.name}
                  </span>
                ))}
              </div>
            )}
            <Button 
              onClick={handleAddComment} 
              disabled={isLoading || !comment.trim()}
              className="ml-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Caricamento...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Aggiungi commento
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Selector per cambiare status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Cambia status</h3>
        <Select value={selectedStatus} onValueChange={handleStatusChange} disabled={isLoading}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Seleziona status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Attivo</SelectItem>
            <SelectItem value="high-risk">High Risk</SelectItem>
            <SelectItem value="critical-risk">Critical Risk</SelectItem>
            <SelectItem value="reviewed">Revisionato</SelectItem>
            <SelectItem value="escalated">Escalato</SelectItem>
            <SelectItem value="archived">Archiviato</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground mt-2">
          Status attuale: <span className="font-semibold">{statusLabels[currentStatus] || currentStatus}</span>
        </p>
      </Card>

      {/* Timeline delle attività */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Timeline attività</h3>
        {isLoadingActivities ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nessuna attività registrata</p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-4 pb-4 border-b last:border-0">
                <div className={`flex-shrink-0 mt-1 ${getActivityColor(activity.activity_type)}`}>
                  {getActivityIcon(activity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold">
                      {activity.activity_type === 'comment' && 'Commento'}
                      {activity.activity_type === 'status_change' && 'Cambio status'}
                      {activity.activity_type === 'auto_retrigger' && 'Re-trigger automatico'}
                    </span>
                    {activity.created_by && activity.created_by !== 'system' && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {activity.created_by}
                      </span>
                    )}
                    {activity.created_by === 'system' && (
                      <span className="text-sm text-muted-foreground">Sistema</span>
                    )}
                    <span className="text-sm text-muted-foreground ml-auto flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(activity.created_at)}
                    </span>
                  </div>
                  
                  {activity.activity_type === 'status_change' && (
                    <div className="text-sm mt-2">
                      <span className="font-medium">{statusLabels[activity.old_status || ''] || activity.old_status}</span>
                      <ArrowRight className="h-3 w-3 inline mx-2" />
                      <span className="font-medium">{statusLabels[activity.new_status || ''] || activity.new_status}</span>
                    </div>
                  )}
                  
                  {activity.activity_type === 'auto_retrigger' && (
                    <div className="text-sm mt-2">
                      <span className="font-medium text-orange-600">{statusLabels[activity.old_status || ''] || activity.old_status}</span>
                      <ArrowRight className="h-3 w-3 inline mx-2" />
                      <span className="font-medium text-red-600">{statusLabels[activity.new_status || ''] || activity.new_status}</span>
                      {activity.content && (
                        <p className="text-muted-foreground mt-1">{activity.content}</p>
                      )}
                    </div>
                  )}
                  
                  {activity.content && activity.activity_type === 'comment' && (
                    <p className="text-sm mt-2 whitespace-pre-wrap">{activity.content}</p>
                  )}
                  
                  {activity.metadata?.attachments && activity.metadata.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activity.metadata.attachments.map((url: string, idx: number) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Paperclip className="h-3 w-3" />
                          {url.startsWith('http') ? `Allegato ${idx + 1}` : url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

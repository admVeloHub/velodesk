/**
 * VelonewsCommentThread v1.0.0 — thread de comentários (Desk)
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useRef, useState } from 'react';
import { addVeloNewsComment } from '../../api/veloNewsApi';
import { useVeloNews } from './VeloNewsProvider';

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins} min atrás`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VelonewsCommentThread({ newsId, thread = [], onCommentAdded }) {
  const { userName } = useVeloNews();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    setComments(Array.isArray(thread) ? thread : []);
  }, [thread]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) {
      setError('O comentário não pode estar vazio');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await addVeloNewsComment(newsId, userName, newComment.trim());
      if (result.success && result.news) {
        const updated = result.news.thread || [];
        setComments(updated);
        setNewComment('');
        onCommentAdded?.(updated);
      } else {
        throw new Error(result.error || 'Erro ao adicionar comentário');
      }
    } catch (err) {
      setError(err.message || 'Erro ao adicionar comentário. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="velonews-comment-thread">
      <div className="velonews-comment-thread__head">
        <h3>Comentários ({comments.length})</h3>
      </div>
      <div className="velonews-comment-thread__list">
        {comments.length === 0 ? (
          <p className="velonews-comment-thread__empty">Nenhum comentário ainda.</p>
        ) : (
          comments.map((comment, index) => (
            <div key={index} className="velonews-comment-thread__item">
              <div className="velonews-comment-thread__avatar" aria-hidden="true">
                {(comment.userName || '?').charAt(0).toUpperCase()}
              </div>
              <div className="velonews-comment-thread__body">
                <div className="velonews-comment-thread__meta">
                  <strong>{comment.userName || 'Usuário'}</strong>
                  <time>{formatTimestamp(comment.timestamp)}</time>
                </div>
                <p>{comment.comentario}</p>
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>
      <form className="velonews-comment-thread__form" onSubmit={handleSubmit}>
        {error ? <p className="velonews-comment-thread__error">{error}</p> : null}
        <textarea
          value={newComment}
          onChange={(e) => {
            setNewComment(e.target.value);
            setError(null);
          }}
          placeholder="Digite seu comentário..."
          rows={2}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !newComment.trim()}>
          {isLoading ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}

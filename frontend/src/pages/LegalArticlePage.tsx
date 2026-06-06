import { useToast } from '../hooks/useToast'
import Toaster from '../components/Toaster'
import ConfirmDialog from '../components/ConfirmDialog'
import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { LegalArticle } from '../types'
import { useConfirmDialog } from '../hooks/useConfirmDialog'

export default function LegalArticlePage() {
  const [articles, setArticles] = useState<LegalArticle[]>([])
  const [keyword, setKeyword] = useState('')
  const [verifyText, setVerifyText] = useState('')
  const [verifyResult, setVerifyResult] = useState<any[]>([])
  const [form, setForm] = useState({ law_name: '', article_no: '', title: '', content: '' })
  const { toasts, showToast, removeToast } = useToast()
  const { confirm, dialogProps } = useConfirmDialog()

  const load = async () => {
    try {
      setArticles(await api.legalArticles.list(keyword.trim()))
    } catch (e: any) {
      showToast(e.message || '法条加载失败', { type: 'err' })
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.law_name.trim() || !form.article_no.trim()) return showToast('法律名称和条号不能为空', { type: 'err' })
    try {
      await api.legalArticles.create(form)
      setForm({ law_name: '', article_no: '', title: '', content: '' })
      await load()
      showToast('法条已保存')
    } catch (e: any) {
      showToast(e.message || '保存失败', { type: 'err' })
    }
  }

  const del = async (id: string) => {
    const article = articles.find(item => item.id === id)
    const confirmed = await confirm({
      title: '删除法条',
      message: `确认删除${article ? `《${article.law_name}》第${article.article_no}条` : '该法条'}？删除后引用核验将无法匹配该条文。`,
      variant: 'danger',
      confirmText: '删除'
    })
    if (!confirmed) return
    try {
      await api.legalArticles.delete(id)
      await load()
      showToast('法条已删除')
    } catch (e: any) {
      showToast(e.message || '删除失败', { type: 'err' })
    }
  }

  const verify = async () => {
    if (!verifyText.trim()) return showToast('请先粘贴需要核验的文本', { type: 'err' })
    try {
      const data = await api.legalArticles.verify(verifyText)
      setVerifyResult(data.references || [])
    } catch (e: any) {
      showToast(e.message || '核验失败', { type: 'err' })
    }
  }

  const matchedCount = verifyResult.filter(item => item.matched).length
  const missingCount = verifyResult.filter(item => !item.matched).length

  return (
    <div>
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">LEGAL SOURCE CHECK</div>
          <h2>法条核验</h2>
          <p>维护本地法条库，自动识别文本中的《法律名称》第X条引用，并标记已匹配、未收录和需人工复核事项。</p>
        </div>
        <button className="btn btn-o" onClick={load}>刷新法条库</button>
      </div>

      <div className="verify-summary">
        <div className="trust-card accent"><strong>本地法条</strong><span>{articles.length} 条已收录，可用于引用核验。</span></div>
        <div className="trust-card success"><strong>已匹配引用</strong><span>{matchedCount} 条引用已在本地法条库命中。</span></div>
        <div className={`trust-card ${missingCount > 0 ? 'warn' : ''}`}><strong>需人工复核</strong><span>{missingCount > 0 ? `${missingCount} 条引用未收录或需补充。` : '暂无未收录引用。'}</span></div>
      </div>

      <div className="evidence-grid mb-5">
        <div className="card">
          <div className="card-hd">
            <div>
              <span className="card-title">录入法条</span>
              <p className="text-xs-desc">同一法律名称和条号会自动更新，避免重复录入。</p>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <input className="input" placeholder="法律名称，例如：民法典" value={form.law_name} onChange={e=>setForm({...form,law_name:e.target.value})} />
            <input className="input" placeholder="条号，例如：五百七十七" value={form.article_no} onChange={e=>setForm({...form,article_no:e.target.value})} />
            <input className="input" placeholder="标题（可选）" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
            <textarea className="textarea" style={{height:130}} placeholder="条文内容" value={form.content} onChange={e=>setForm({...form,content:e.target.value})} />
            <button className="btn btn-p" onClick={save}>保存法条</button>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <div>
              <span className="card-title">引用核验</span>
              <p className="text-xs-desc">支持识别格式： 《民法典》第五百七十七条。</p>
            </div>
          </div>
          <textarea className="textarea" style={{height:150}} placeholder="粘贴 AI 初稿或律师审查文本" value={verifyText} onChange={e=>setVerifyText(e.target.value)} />
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <button className="btn btn-p" onClick={verify}>核验引用</button>
            <button className="btn btn-o" onClick={() => { setVerifyText(''); setVerifyResult([]) }}>清空</button>
          </div>
          <div className="notice-card notice-warn" style={{marginTop:12,marginBottom:0}}>
            <div><strong>核验边界</strong><span>本功能只校验引用是否存在于本地法条库，不替代律师对现行有效性、适用条件和诉讼策略的判断。</span></div>
          </div>
        </div>
      </div>

      {verifyResult.length > 0 && (
        <div className="card mb-5">
          <div className="card-hd"><span className="card-title">核验结果</span><span className={`tag ${missingCount > 0 ? 't-orange' : 't-green'}`}>{missingCount > 0 ? '需复核' : '引用已匹配'}</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {verifyResult.map((item, index) => (
              <div key={`${item.law_name}-${item.article_no}-${index}`} className={`verify-result-card ${item.matched ? 'matched' : 'missing'}`}>
                <div className="flex items-center justify-between" style={{gap:10}}>
                  <strong className="text-sm">《{item.law_name}》第{item.article_no}条</strong>
                  <span className={`tag ${item.matched ? 't-green' : 't-red'}`}>{item.matched ? '已匹配' : '未收录'}</span>
                </div>
                {item.title && <div style={{fontSize:12,color:'#4b5563',marginTop:6,fontWeight:600}}>{item.title}</div>}
                {item.content && <div style={{fontSize:12,color:'#64748b',lineHeight:1.7,marginTop:6}}>{item.content.slice(0, 180)}{item.content.length > 180 ? '...' : ''}</div>}
                {!item.matched && <div style={{fontSize:12,color:'#b91c1c',marginTop:6}}>建议补录该法条，或由律师确认引用名称、条号和现行有效性。</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-0">
        <div className="panel-head">
          <div>
            <span className="card-title">本地法条库</span>
            <p>用于文书引用核验，可按法律名称、条号或内容搜索。</p>
          </div>
          <div style={{display:'flex',gap:8,minWidth:280}}>
            <input className="input" placeholder="搜索法律名称或内容" value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') load() }} />
            <button className="btn btn-o" onClick={load}>搜索</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>法律名称</th><th>条号</th><th>标题</th><th>内容摘要</th><th>操作</th></tr></thead>
            <tbody>
              {articles.map(article => (
                <tr key={article.id}>
                  <td>{article.law_name}</td>
                  <td><span className="tag t-blue">第{article.article_no}条</span></td>
                  <td>{article.title || '-'}</td>
                  <td style={{maxWidth:420,color:'#64748b',fontSize:12,lineHeight:1.6}}>{article.content ? `${article.content.slice(0, 120)}${article.content.length > 120 ? '...' : ''}` : '-'}</td>
                  <td><button className="btn btn-d btn-sm" onClick={()=>del(article.id)}>删除</button></td>
                </tr>
              ))}
              {articles.length === 0 && <tr><td colSpan={5}><div className="empty refined-empty p-lg"><p>暂无法条数据，录入后可用于引用核验</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Toaster toasts={toasts} onRemove={removeToast} />
      {dialogProps && <ConfirmDialog {...dialogProps} />}
    </div>
  )
}

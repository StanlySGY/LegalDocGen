import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { LegalArticle } from '../types'

export default function LegalArticlePage() {
  const [articles, setArticles] = useState<LegalArticle[]>([])
  const [keyword, setKeyword] = useState('')
  const [verifyText, setVerifyText] = useState('')
  const [verifyResult, setVerifyResult] = useState<any[]>([])
  const [form, setForm] = useState({ law_name: '', article_no: '', title: '', content: '' })
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const showToast = (msg:string,type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),2500) }

  const load = async () => {
    try {
      setArticles(await api.legalArticles.list(keyword.trim()))
    } catch (e: any) {
      showToast(e.message || '法条加载失败', 'err')
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.law_name.trim() || !form.article_no.trim()) return showToast('法律名称和条号不能为空', 'err')
    try {
      await api.legalArticles.create(form)
      setForm({ law_name: '', article_no: '', title: '', content: '' })
      await load()
      showToast('法条已保存')
    } catch (e: any) {
      showToast(e.message || '保存失败', 'err')
    }
  }

  const del = async (id: string) => {
    try {
      await api.legalArticles.delete(id)
      await load()
      showToast('法条已删除')
    } catch (e: any) {
      showToast(e.message || '删除失败', 'err')
    }
  }

  const verify = async () => {
    try {
      const data = await api.legalArticles.verify(verifyText)
      setVerifyResult(data.references || [])
    } catch (e: any) {
      showToast(e.message || '核验失败', 'err')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 page-title-row">
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'#1d2129'}}>法条核验</h2>
          <p style={{fontSize:13,color:'#86909c',marginTop:4}}>维护本地法条库，并核验文本中的《法律名称》第X条引用</p>
        </div>
        <button className="btn btn-o" onClick={load}>刷新</button>
      </div>

      <div className="evidence-grid" style={{marginBottom:20}}>
        <div className="card">
          <div className="card-title" style={{marginBottom:12}}>录入法条</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <input className="input" placeholder="法律名称，例如：民法典" value={form.law_name} onChange={e=>setForm({...form,law_name:e.target.value})} />
            <input className="input" placeholder="条号，例如：五百七十七" value={form.article_no} onChange={e=>setForm({...form,article_no:e.target.value})} />
            <input className="input" placeholder="标题（可选）" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
            <textarea className="textarea" style={{height:120}} placeholder="条文内容" value={form.content} onChange={e=>setForm({...form,content:e.target.value})} />
            <button className="btn btn-p" onClick={save}>保存法条</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{marginBottom:12}}>引用核验</div>
          <textarea className="textarea" style={{height:160}} placeholder="粘贴包含法条引用的文本，例如：《民法典》第五百七十七条" value={verifyText} onChange={e=>setVerifyText(e.target.value)} />
          <button className="btn btn-p" style={{marginTop:10}} onClick={verify}>核验引用</button>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:12}}>
            {verifyResult.map((item, index) => (
              <div key={`${item.law_name}-${item.article_no}-${index}`} style={{border:'1px solid #e5e7eb',borderRadius:8,padding:10}}>
                <div className="flex items-center justify-between">
                  <strong style={{fontSize:13}}>《{item.law_name}》第{item.article_no}条</strong>
                  <span className={`tag ${item.matched ? 't-green' : 't-red'}`}>{item.matched ? '已匹配' : '未收录'}</span>
                </div>
                {item.title && <div style={{fontSize:12,color:'#4b5563',marginTop:6}}>{item.title}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{padding:0}}>
        <div style={{padding:16,borderBottom:'1px solid #e5e7eb'}} className="flex gap-2">
          <input className="input" placeholder="搜索法律名称或内容" value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') load() }} />
          <button className="btn btn-o" onClick={load}>搜索</button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>法律名称</th><th>条号</th><th>标题</th><th>内容</th><th>操作</th></tr></thead>
            <tbody>
              {articles.map(article => (
                <tr key={article.id}>
                  <td>{article.law_name}</td>
                  <td>第{article.article_no}条</td>
                  <td>{article.title || '-'}</td>
                  <td style={{maxWidth:420}}>{article.content ? `${article.content.slice(0, 120)}${article.content.length > 120 ? '...' : ''}` : '-'}</td>
                  <td><button className="btn btn-d btn-sm" onClick={()=>del(article.id)}>删除</button></td>
                </tr>
              ))}
              {articles.length === 0 && <tr><td colSpan={5}><div className="empty" style={{padding:'50px 0'}}><p>暂无法条数据</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

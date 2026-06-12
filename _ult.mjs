import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
global.window = dom.window; global.document = dom.window.document
global.Node = dom.window.Node; global.DOMParser = dom.window.DOMParser
global.requestAnimationFrame = (f)=>setTimeout(f,0)
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
const el = document.createElement('div'); document.body.appendChild(el)
const editor = new Editor({ element: el, extensions: [StarterKit.configure({heading:{levels:[1,2,3]},codeBlock:false}), Underline, Link.configure({openOnClick:false,autolink:true}), Markdown.configure({ html: true, linkify:true, transformPastedText:true, transformCopiedText:true })], content: '<p>hello world</p>' })
editor.commands.setTextSelection({ from: 1, to: 6 })
editor.chain().toggleUnderline().run()
const md = editor.storage.markdown.getMarkdown()
console.log('MD', JSON.stringify(md))
editor.commands.setContent(md)
console.log('reloaded HTML', editor.getHTML())

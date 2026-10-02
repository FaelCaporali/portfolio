import type { MetaFunction } from 'react-router'
import { McpPage } from '../features/mcp/McpPage'
import { pageMeta } from '../i18n/meta'

export const meta: MetaFunction = ({ params }) => pageMeta(params.lang, 'mcp')

/**
 * Como conectar o assistente de IA ao MCP do portfólio (/mcp). O mesmo endereço, pedido por um cliente MCP, é o
 * servidor (worker/index.ts); no navegador, esta página, que sai pronta do build.
 */
export default function Mcp() {
  return <McpPage />
}

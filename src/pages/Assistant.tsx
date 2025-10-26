import { useState, useRef, useEffect } from 'react'
import { useOverview, useReceipts, useDeliveries, fetchShipments, queryGeminiAI, queryGeminiAIStream, checkAvailableModels, testStreamingAPI } from '../lib/api'
import { Send, Bot, User, Loader2, AlertCircle, TrendingUp, Package, MapPin, Clock, CheckCircle, Settings } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

interface ShipmentData {
  id: string
  name: string
  status: string
  path: Array<{ lat: number; lng: number }>
  custodian?: string
  eta?: string
  sla?: string
  leg?: string
  speedCategory?: string
  createdAt?: number
  lastUpdate?: number
}

export function Assistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant for supply chain management powered by Gemini AI. I can help you analyze your shipments, identify potential issues, and provide insights about your logistics operations. What would you like to know?',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<'connected' | 'offline' | 'unknown'>('unknown')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [checkingModels, setCheckingModels] = useState(false)
  const [testingStreaming, setTestingStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: overview } = useOverview()
  const { data: receipts } = useReceipts(50)
  const { data: deliveries } = useDeliveries()
  const [shipments, setShipments] = useState<ShipmentData[]>([])

  // Load shipments data
  useEffect(() => {
    const loadShipments = async () => {
      try {
        const data = await fetchShipments()
        setShipments(data)
      } catch (error) {
        console.error('Failed to load shipments:', error)
      }
    }
    loadShipments()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const generateContextData = () => {
    const activeShipments = shipments.filter(s => s.status === 'in_transit')
    const deliveredShipments = shipments.filter(s => s.status === 'delivered')
    const delayedShipments = shipments.filter(s => s.sla === 'RISK' || s.sla === 'LATE')
    const totalValue = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0

    return {
      totalShipments: shipments.length,
      activeShipments: activeShipments.length,
      deliveredShipments: deliveredShipments.length,
      delayedShipments: delayedShipments.length,
      totalValue: totalValue,
      recentShipments: shipments.slice(0, 5).map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        custodian: s.custodian,
        eta: s.eta,
        sla: s.sla
      })),
      delayedShipmentsList: delayedShipments.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        sla: s.sla,
        eta: s.eta
      })),
      systemStatus: {
        online: true,
        lastUpdate: new Date().toISOString()
      }
    }
  }

  // Using the real Gemini API for AI responses

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Create a placeholder message for the assistant response
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }

    setMessages(prev => [...prev, assistantMessage])

    try {
      const contextData = generateContextData()
      
      // Try streaming first, fallback to regular API if streaming fails
      try {
        let fullResponse = ''
        
        await queryGeminiAIStream(userMessage.content, contextData, (chunk: string) => {
          fullResponse += chunk
          
          // Update the message with the current content
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: fullResponse, isStreaming: true }
              : msg
          ))
        })
        
        // Mark streaming as complete
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, isStreaming: false }
            : msg
        ))
        
        setAiStatus('connected')
      } catch (streamingError) {
        console.warn('Streaming failed, falling back to regular API:', streamingError)
        
        // Fallback to regular API
        const response = await queryGeminiAI(userMessage.content, contextData)
        
        // Update the assistant message with the response
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: response.content, isStreaming: false }
            : msg
        ))
        
        setAiStatus(response.error ? 'offline' : 'connected')
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error)
      setAiStatus('offline')
      
      // Update the assistant message with error
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: 'Sorry, I encountered an error while processing your request. Please try again.',
              isStreaming: false 
            }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleCheckModels = async () => {
    setCheckingModels(true)
    try {
      const models = await checkAvailableModels()
      setAvailableModels(models)
      
      // Add a message about the available models
      const modelsMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `## Available Gemini Models

I found ${models.length} available models:

${models.map(model => `- **${model}**`).join('\n')}

The current model being used is: **gemini-pro-latest**

**Recommended models for your use case:**
- **gemini-2.5-flash** - Fast and efficient (recommended)
- **gemini-2.5-pro** - Most capable model
- **gemini-pro-latest** - Current stable model (currently in use)

You can see the full model names in the browser console for more details.`,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, modelsMessage])
    } catch (error) {
      console.error('Error checking models:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t check the available models. Please check the browser console for more details.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setCheckingModels(false)
    }
  }

  const handleTestStreaming = async () => {
    setTestingStreaming(true)
    try {
      const result = await testStreamingAPI()
      
      const testMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `## Streaming API Test Results

**Status:** ${result.success ? '✅ Success' : '❌ Failed'}
**Message:** ${result.message}
**Chunks Received:** ${result.chunks.length}

${result.chunks.length > 0 ? `
**Received Chunks:**
${result.chunks.map((chunk, index) => `${index + 1}. "${chunk}"`).join('\n')}

**Full Response:**
"${result.chunks.join('')}"
` : 'No chunks were received. Check the browser console for detailed logs.'}

Check the browser console for detailed streaming logs.`,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, testMessage])
    } catch (error) {
      console.error('Error testing streaming:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t test the streaming API. Please check the browser console for more details.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setTestingStreaming(false)
    }
  }

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/g, '<br>')
  }

  return (
    <section aria-label="AI Assistant" className="fade-in">
      <div className="topbar-gap" />
      
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 12, 
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Bot size={24} />
          </div>
          <div>
            <h1 style={{ 
              margin: 0, 
              background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              backgroundClip: 'text' 
            }}>
              AI Assistant
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <p style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--muted)', fontWeight: 'var(--font-normal)' }}>
                Your intelligent supply chain analyst
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-semibold)',
                background: aiStatus === 'connected' ? 'rgba(5, 150, 105, 0.1)' : aiStatus === 'offline' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                color: aiStatus === 'connected' ? 'var(--success)' : aiStatus === 'offline' ? 'var(--danger)' : 'var(--muted)',
                border: `1px solid ${aiStatus === 'connected' ? 'rgba(5, 150, 105, 0.2)' : aiStatus === 'offline' ? 'rgba(220, 38, 38, 0.2)' : 'rgba(100, 116, 139, 0.2)'}`
              }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: aiStatus === 'connected' ? 'var(--success)' : aiStatus === 'offline' ? 'var(--danger)' : 'var(--muted)',
                  animation: aiStatus === 'connected' ? 'pulse 2s infinite' : 'none'
                }}></div>
                {aiStatus === 'connected' ? 'AI Connected' : aiStatus === 'offline' ? 'Offline Mode' : 'Connecting...'}
              </div>
              <button
                onClick={handleCheckModels}
                disabled={checkingModels}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  fontSize: 'var(--text-xs)',
                  cursor: checkingModels ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!checkingModels) {
                    e.currentTarget.style.background = 'var(--border-light)'
                    e.currentTarget.style.borderColor = 'var(--primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!checkingModels) {
                    e.currentTarget.style.background = 'var(--panel)'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }
                }}
              >
                {checkingModels ? <Loader2 size={12} className="animate-spin" /> : <Settings size={12} />}
                {checkingModels ? 'Checking...' : 'Check Models'}
              </button>
              <button
                onClick={handleTestStreaming}
                disabled={testingStreaming}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  fontSize: 'var(--text-xs)',
                  cursor: testingStreaming ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!testingStreaming) {
                    e.currentTarget.style.background = 'var(--border-light)'
                    e.currentTarget.style.borderColor = 'var(--primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!testingStreaming) {
                    e.currentTarget.style.background = 'var(--panel)'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }
                }}
              >
                {testingStreaming ? <Loader2 size={12} className="animate-spin" /> : <AlertCircle size={12} />}
                {testingStreaming ? 'Testing...' : 'Test Streaming'}
              </button>
            </div>
          </div>
        </div>
        <div className="divider-thick"></div>
      </div>

      {/* Chat Container */}
      <div className="card" style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', padding: 0 }}>
        {/* Messages Area */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              {message.role === 'assistant' && (
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0
                }}>
                  <Bot size={16} />
                </div>
              )}
              
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: message.role === 'user' 
                  ? 'linear-gradient(135deg, var(--primary), var(--primary-light))'
                  : 'var(--border-light)',
                color: message.role === 'user' ? 'white' : 'var(--text)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                position: 'relative'
              }}>
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: formatMessage(message.content) 
                }}
                style={{
                  lineHeight: 1.5,
                  fontSize: 'var(--text-sm)'
                }}
              />
              {message.isStreaming && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--muted)',
                  fontStyle: 'italic',
                  marginTop: '8px',
                  fontSize: 'var(--text-xs)'
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    animation: 'pulse 1.5s infinite'
                  }}></div>
                  <span>AI is thinking...</span>
                </div>
              )}
                <div style={{
                  fontSize: 'var(--text-xs)',
                  opacity: 0.7,
                  marginTop: '8px',
                  textAlign: 'right'
                }}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>

              {message.role === 'user' && (
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text)',
                  flexShrink: 0
                }}>
                  <User size={16} />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                flexShrink: 0
              }}>
                <Bot size={16} />
              </div>
              <div style={{
                padding: '12px 16px',
                borderRadius: '16px 16px 16px 4px',
                background: 'var(--border-light)',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Loader2 size={16} className="animate-spin" />
                <span>Analyzing your data...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--panel)'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about your shipments, delays, or performance..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: 'var(--text-sm)',
                resize: 'none',
                outline: 'none'
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                border: 'none',
                background: inputValue.trim() && !isLoading 
                  ? 'linear-gradient(135deg, var(--primary), var(--primary-light))'
                  : 'var(--border)',
                color: inputValue.trim() && !isLoading ? 'white' : 'var(--muted)',
                cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 'var(--font-semibold)',
                transition: 'all 0.2s ease'
              }}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send
            </button>
          </div>
          
          {/* Quick Actions */}
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              'Show me delayed shipments',
              'What\'s the current status?',
              'Any performance issues?',
              'Generate analytics report'
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInputValue(suggestion)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--border-light)'
                  e.currentTarget.style.borderColor = 'var(--primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--panel)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

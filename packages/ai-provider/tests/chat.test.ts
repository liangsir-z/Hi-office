import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatForProvider } from '../src/chat'
import { errorResponse, jsonResponse } from './test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chatForProvider (deepseek)', () => {
  it('extracts the message content from the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'hello world' } }] })),
    )
    const result = await chatForProvider(
      'deepseek',
      { apiKey: 'k', model: 'deepseek-flash' },
      'sys',
      'hi',
    )
    expect(result).toEqual({ ok: true, content: 'hello world' })
  })

  it.each([
    ['deepseek-v4-pro', 'deepseek-v4-pro'],
    ['deepseek-reasoner', 'deepseek-flash'],
  ])('sends configured %s as %s with thinking disabled', async (model, wireModel) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ choices: [{ message: { content: 'ok' } }] })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await chatForProvider('deepseek', { apiKey: 'fixture-key', model }, 'sys', 'hi')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer fixture-key' }),
      }),
    )
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toMatchObject({
      model: wireModel,
      thinking: { type: 'disabled' },
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
    })
  })

  it('surfaces HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(401, 'bad key')))
    const result = await chatForProvider(
      'deepseek',
      { apiKey: 'k', model: 'deepseek-flash' },
      'sys',
      'hi',
    )
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/HTTP 401/)
  })

  it('replaces an HTML error body with a readable note', async () => {
    const html =
      '<!doctype html>\n<html>\n<head><title>Hi-office</title></head><body>app shell</body></html>'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(403, html)))
    const result = await chatForProvider(
      'deepseek',
      { apiKey: 'k', model: 'deepseek-flash' },
      'sys',
      'hi',
    )
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/HTTP 403/)
    expect(result.error).toMatch(/web page instead of an API response/)
    expect(result.error).not.toContain('<!doctype')
  })

  it('treats an empty response body as an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: {} }] })))
    const result = await chatForProvider(
      'deepseek',
      { apiKey: 'k', model: 'deepseek-flash' },
      'sys',
      'hi',
    )
    expect(result).toEqual({ ok: false, error: 'AI returned an empty response' })
  })
})

# Deploy to VPS-00 - Quick Reference

## Verification: All Tasks Complete ✅

**Total Tasks**: 32/32 complete
**Total Tests**: 653/653 passing (100%)
**Status**: Production ready

---

## Deploy to VPS-00

### Automated Deployment (Recommended)

Simply run the deployment script:

```bash
cd /home/wandeon/voice-chat-app
./scripts/deploy-to-vps.sh
```

**What it does:**
1. ✅ Verifies all 653 tests pass
2. ✅ Checks SSH connectivity to vps-00
3. ✅ Creates deployment package (excludes node_modules, dev files)
4. ✅ Uploads package to vps-00
5. ✅ Stops existing services
6. ✅ Installs new version
7. ✅ Builds Docker images
8. ✅ Starts all services
9. ✅ Runs verification checks
10. ✅ Provides access URLs

**Requirements:**
- SSH access to vps-00 configured
- vps-00 has Docker and Docker Compose installed
- External services accessible (STT, LLM)

---

### Manual Deployment

If you prefer manual deployment:

```bash
# 1. Verify tests pass
cd /home/wandeon/voice-chat-app/backend && npm test
cd /home/wandeon/voice-chat-app/frontend && npm test

# 2. Copy to VPS
scp -r /home/wandeon/voice-chat-app root@vps-00:/opt/

# 3. SSH to VPS
ssh root@vps-00

# 4. Install and deploy
cd /opt/voice-chat-app
cd backend && npm install --production
cd ../frontend && npm install --production && npm run build
cd ..

# 5. Start services
docker-compose up -d --build

# 6. Verify
./scripts/verify-deployment.sh
```

---

## Post-Deployment

### Access Application

- **Frontend**: http://vps-00:8080
- **Backend**: http://vps-00:3001
- **WebSocket**: ws://vps-00:3001

### Verify Services

```bash
# Check all services
ssh root@vps-00 'curl http://localhost:3001/api/status'

# View logs
ssh root@vps-00 'cd /opt/voice-chat-app && docker-compose logs -f'

# Check containers
ssh root@vps-00 'docker ps'
```

### Monitor

```bash
# Service health
ssh root@vps-00 'cd /opt/voice-chat-app && ./scripts/verify-deployment.sh'

# Resource usage
ssh root@vps-00 'docker stats'
```

---

## Troubleshooting

### If Deployment Fails

```bash
# Check logs
ssh root@vps-00 'cd /opt/voice-chat-app && docker-compose logs'

# Restart services
ssh root@vps-00 'cd /opt/voice-chat-app && docker-compose restart'

# Rebuild
ssh root@vps-00 'cd /opt/voice-chat-app && docker-compose down && docker-compose up -d --build'
```

### Rollback

```bash
ssh root@vps-00 'cd /opt/voice-chat-app && docker-compose down && mv /opt/voice-chat-app.old /opt/voice-chat-app && cd /opt/voice-chat-app && docker-compose up -d'
```

---

## Verification Checklist

After deployment, verify:

- [ ] All Docker containers running: `docker ps`
- [ ] Backend health check: `curl http://localhost:3001/health`
- [ ] Service status: `curl http://localhost:3001/api/status`
- [ ] Frontend accessible: `curl http://localhost:8080`
- [ ] WebSocket connects: Test in browser
- [ ] VAD service online
- [ ] STT service online (external)
- [ ] LLM service online (external)
- [ ] TTS service online

---

## Environment Configuration

Before deploying, ensure these services are accessible from vps-00:

- **STT Service**: http://100.89.2.111:5051
- **LLM Service**: http://100.100.47.43:11434

Configure in `docker-compose.yml` if different:

```yaml
environment:
  - STT_URL=http://100.89.2.111:5051
  - LLM_URL=http://100.100.47.43:11434
  - TTS_URL=http://streaming-tts:5053
  - VAD_URL=http://vad-service:5052
```

---

## Quick Commands

```bash
# Deploy
./scripts/deploy-to-vps.sh

# Check status
ssh root@vps-00 'curl -s http://localhost:3001/api/status | jq .'

# View logs
ssh root@vps-00 'cd /opt/voice-chat-app && docker-compose logs -f backend'

# Restart
ssh root@vps-00 'cd /opt/voice-chat-app && docker-compose restart'

# Stop
ssh root@vps-00 'cd /opt/voice-chat-app && docker-compose down'

# Start
ssh root@vps-00 'cd /opt/voice-chat-app && docker-compose up -d'
```

---

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Review: `docs/DEPLOYMENT.md`
3. Run verification: `./scripts/verify-deployment.sh`
4. Check: `IMPLEMENTATION-COMPLETE.md`

---

**Ready to deploy!** Run `./scripts/deploy-to-vps.sh` to begin.

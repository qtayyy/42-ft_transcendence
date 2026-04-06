#!/bin/bash
set -e

echo "Applying ArgoCD Application..."
kubectl apply -f "$(dirname "$0")/app.yaml"

echo "Application applied. Check status with:"
echo "  kubectl get app ft-transcendence -n argocd"

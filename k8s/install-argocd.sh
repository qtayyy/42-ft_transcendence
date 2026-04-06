#!/bin/bash
set -e

echo "Creating argocd namespace..."
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

echo "Installing ArgoCD..."
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo "Waiting for ArgoCD pods to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/argocd-server -n argocd

echo "ArgoCD installed successfully."
echo ""
echo "To access the ArgoCD UI, run:"
echo "  kubectl port-forward svc/argocd-server -n argocd 8443:443"
echo ""
echo "Default admin password:"
echo "  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"

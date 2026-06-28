pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  parameters {
    string(name: 'AWS_REGION', defaultValue: 'ap-southeast-1', description: 'AWS region for ECR and EC2')
    string(name: 'ECR_REPOSITORY', defaultValue: 'c2-app-065-backend', description: 'ECR repository name')
    string(name: 'AWS_CREDENTIALS_ID', defaultValue: 'aws-jenkins', description: 'Jenkins AWS credentials id')
    booleanParam(name: 'DEPLOY_TO_EC2', defaultValue: true, description: 'Deploy to EC2 after pushing image')
    string(name: 'EC2_HOST', defaultValue: '', description: 'EC2 public DNS/IP. Leave empty to skip deploy')
    string(name: 'EC2_USER', defaultValue: 'ubuntu', description: 'SSH user on EC2')
    string(name: 'EC2_SSH_CREDENTIALS_ID', defaultValue: 'ec2-ssh-key', description: 'Jenkins SSH private key credentials id')
    string(name: 'DEPLOY_DIR', defaultValue: '/opt/edumate', description: 'Directory on EC2 containing docker-compose.prod.yml and .env.production')
  }

  environment {
    DOCKER_BUILDKIT = '1'
    AWS_REGION = "${params.AWS_REGION}"
    ECR_REPOSITORY = "${params.ECR_REPOSITORY}"
  }

  stages {
    stage('Prepare') {
      steps {
        checkout scm
        script {
          env.SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.SHORT_SHA}"
        }
      }
    }

    stage('Backend Checks') {
      steps {
        sh '''
          set -eu
          python3 -m venv .venv
          . .venv/bin/activate
          pip install --upgrade pip
          pip install -r requirements.txt
          ruff check src/ tests/
          pytest tests/test_services tests/test_api -q
        '''
      }
    }

    stage('Frontend Checks') {
      steps {
        sh '''
          set -eu
          cd frontend
          npm ci
          npm run lint
          npm run build
        '''
      }
    }

    stage('Build Image') {
      steps {
        sh '''
          set -eu
          docker build --pull -t "$ECR_REPOSITORY:$IMAGE_TAG" .
        '''
      }
    }

    stage('Push Image to ECR') {
      steps {
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: params.AWS_CREDENTIALS_ID]]) {
          sh '''
            set -eu
            AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
            ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

            if ! aws ecr describe-repositories --repository-names "$ECR_REPOSITORY" --region "$AWS_REGION" >/dev/null 2>&1; then
              aws ecr create-repository \
                --repository-name "$ECR_REPOSITORY" \
                --image-scanning-configuration scanOnPush=true \
                --region "$AWS_REGION" >/dev/null
            fi

            aws ecr get-login-password --region "$AWS_REGION" \
              | docker login --username AWS --password-stdin "$ECR_REGISTRY"

            docker tag "$ECR_REPOSITORY:$IMAGE_TAG" "$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"
            docker tag "$ECR_REPOSITORY:$IMAGE_TAG" "$ECR_REGISTRY/$ECR_REPOSITORY:latest"
            docker push "$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"
            docker push "$ECR_REGISTRY/$ECR_REPOSITORY:latest"

            printf '%s\n' "$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" > image-uri.txt
          '''
        }
      }
    }

    stage('Deploy to EC2') {
      when {
        expression { return params.DEPLOY_TO_EC2 && params.EC2_HOST?.trim() }
      }
      steps {
        script {
          def imageUri = readFile('image-uri.txt').trim()
          def ecrRegistry = imageUri.split('/')[0]

          sshagent(credentials: [params.EC2_SSH_CREDENTIALS_ID]) {
            withEnv([
              "IMAGE_URI=${imageUri}",
              "ECR_REGISTRY=${ecrRegistry}",
              "DEPLOY_USER=${params.EC2_USER}",
              "DEPLOY_HOST=${params.EC2_HOST}",
              "DEPLOY_PATH=${params.DEPLOY_DIR}",
              "DEPLOY_AWS_REGION=${params.AWS_REGION}"
            ]) {
              sh '''
                set -eu
                ssh -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH'"
                scp -o StrictHostKeyChecking=no docker-compose.yml "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/docker-compose.yml"
                ssh -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" "
                  set -eu
                  cd '$DEPLOY_PATH'
                  test -f .env || (echo 'Missing $DEPLOY_PATH/.env on EC2' && exit 1)
                  aws ecr get-login-password --region '$DEPLOY_AWS_REGION' \
                    | docker login --username AWS --password-stdin '$ECR_REGISTRY'
                  BACKEND_IMAGE='$IMAGE_URI' APP_DATA_VOLUME='app_data' docker compose -f docker-compose.yml --env-file .env pull backend
                  BACKEND_IMAGE='$IMAGE_URI' APP_DATA_VOLUME='app_data' docker compose -f docker-compose.yml --env-file .env up -d --remove-orphans
                  BACKEND_IMAGE='$IMAGE_URI' APP_DATA_VOLUME='app_data' docker compose -f docker-compose.yml --env-file .env ps
                  docker image prune -f
                "
              '''
            }
          }
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'image-uri.txt', allowEmptyArchive: true
      sh 'docker rmi -f "$ECR_REPOSITORY:$IMAGE_TAG" || true'
    }
  }
}
